import { NextFunction, Request, Response } from 'express';
import momentTimezone from 'moment-timezone';
import { HttpClientUtil, BearerStrategy } from '../../expressium/src/index.js';
import { IAccountMap, IAlarmMap, IChannelAlarmMap, IEventPayloadMap, INetworkMap, IPartitionMap, IReqBody, IResponse, IResponseData } from './interfaces/index.js';

const EVENT_ID = '167616000';
const PROTOCOL_TYPE = 'CONTACT_ID';

const CODE_MAP = {
  lcd: 'E130',
  pid: 'E602'
};

const getAlarmCode = (channelAlarmMap: IChannelAlarmMap.IChannelAlarmMap): string | null => {
  if (channelAlarmMap.motion_alarm && Object.hasOwn(CODE_MAP, "motion_alarm")) {
    return CODE_MAP['motion_alarm' as keyof typeof CODE_MAP];
  }
  
  const intSubtype = channelAlarmMap.int_alarm?.int_subtype;

  if (intSubtype && Object.hasOwn(CODE_MAP, intSubtype)) {
    return CODE_MAP[intSubtype as keyof typeof CODE_MAP];
  }
  
  return null;
};

const processChannelAlarmList = async (
  alarmMap: IAlarmMap.IAlarmMap,
  networkMap: INetworkMap.INetworkMap, 
  deviceNamePartList: string[]
): Promise<void> => {
  const httpClientInstance = new HttpClientUtil.HttpClient();

  httpClientInstance.setAuthenticationStrategy(new BearerStrategy.BearerStrategy(process.env.SIGMA_CLOUD_BEARER_TOKEN as string));
  
  const accountMap = (await httpClientInstance.get<IAccountMap.IAccountMap>(`https://api.segware.com.br/v5/accounts/${ deviceNamePartList[0] }`)).data;
  const partitionMap = accountMap?.partitions.find((partitionMap: IPartitionMap.IPartitionMap): boolean => String(partitionMap.id) === deviceNamePartList[1]);
  const account = accountMap ? accountMap.accountCode : deviceNamePartList[1];
  const companyId = accountMap ? accountMap.companyId : Number(deviceNamePartList[0]);
  const partition = partitionMap ? partitionMap.number : deviceNamePartList[2];

  if (!account || !companyId || !partition) {
    console.log(`Error | Timestamp: ${ momentTimezone().utc().format('DD-MM-YYYY HH:mm:ss') } | Path: src/services/createSigmaCloudEvents.service.ts | Location: processChannelAlarmList | Error: Invalid account, companyId or partition.`);
    
    return;
  }

  const eventPayloadMapList: IEventPayloadMap.IEventPayloadMap[] = [];

  alarmMap.channel_alarm.forEach(
    (channelAlarmMap: IChannelAlarmMap.IChannelAlarmMap): void => {
      const code = getAlarmCode(channelAlarmMap);

      if (code) {
        eventPayloadMapList.push(
          {
            account,
            auxiliary: channelAlarmMap.channel,
            code,
            companyId,
            complement: `Fabricante: Gabriel, IP: ${ networkMap.ip }, MAC: ${ networkMap.mac }, Local: ${ channelAlarmMap.chn_alias }`,
            eventId: EVENT_ID,
            eventLog: `Fabricante: Gabriel, IP: ${ networkMap.ip }, MAC: ${ networkMap.mac }, Local: ${ channelAlarmMap.chn_alias }`,
            partition,
            protocolType: PROTOCOL_TYPE
          }
        );
      }
    }
  );

  if (eventPayloadMapList.length > 0) {
    await httpClientInstance.post<unknown>('https://api.segware.com.br/v3/events/alarm', { events: eventPayloadMapList });
  }
};

export const createSigmaCloudEvents = async (
  req: Request,
  _res: Response,
  _next: NextFunction,
  timestamp: string
): Promise<IResponse.IResponse<IResponseData.ICreateSigmaCloudEventsResponseData | IResponseData.IResponseData>> => {
  try {
    const body = req.body as IReqBody.ICreateSigmaCloudEventsReqBody;
    const alarmList = body?.data?.alarm_list;

    if (!alarmList) {
      return {
        status: 400,
        data: {
          timestamp,
          status: false,
          statusCode: 400,
          method: req.method,
          path: req.originalUrl || req.url,
          query: req.query,
          headers: req.headers,
          body: req.body,
          message: 'Invalid request body.',
          suggestion: 'Please ensure the request body contains a valid "data.alarm_list" field.'
        }
      };
    }

    if (!alarmList.length) {
      return {
        status: 200,
        data: {
          timestamp,
          status: true,
          statusCode: 200,
          method: req.method,
          path: req.originalUrl || req.url,
          query: req.query,
          headers: req.headers,
          body: req.body
        }
      };
    }

    await Promise.allSettled(alarmList.map((alarmMap: IAlarmMap.IAlarmMap): Promise<void> => processChannelAlarmList(alarmMap, body.data.dev_net_info[0], body.data.device_name.split('_'))));

    return {
      status: 200,
      data: {
        timestamp,
        status: true,
        statusCode: 200,
        method: req.method,
        path: req.originalUrl || req.url,
        query: req.query,
        headers: req.headers,
        body: req.body
      }
    };
  } catch (error: unknown) {
    console.log(`Error | Timestamp: ${ momentTimezone().utc().format('DD-MM-YYYY HH:mm:ss') } | Path: src/services/createSigmaCloudEvents.service.ts | Location: createSigmaCloudEvents | Error: ${ error instanceof Error ? error.message : String(error) }`);
    
    return {
      status: 500,
      data: {
        timestamp,
        status: false,
        statusCode: 500,
        method: req.method,
        path: req.originalUrl || req.url,
        query: req.query,
        headers: req.headers,
        body: req.body,
        message: 'Something went wrong.',
        suggestion: 'Please try again later. If this issue persists, contact our support team for assistance.'
      }
    };
  }
};
