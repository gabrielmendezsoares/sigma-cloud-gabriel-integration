import { Request } from 'express';
import { PrismaClient } from '@prisma/client/storage/index.js'
import { HttpClientUtil, BearerStrategy } from '../../expressium/index.js';
import { IAccountMap, IAlarmMap, IChannelAlarmMap, ICodeMap, INetworkMap, IPartitionMap, IReqBody, IResponse, IResponseData } from './interfaces/index.js';

const EVENT_ID = '167616000';
const PROTOCOL_TYPE = 'CONTACT_ID';

const EVENT_CODE_MAP = {
  lcd: 'E130',
  pid: 'E602'
} as const;

const prisma = new PrismaClient();

const fetchCodeMap = (channelAlarmMap: IChannelAlarmMap.IChannelAlarmMap): ICodeMap.ICodeMap | null => {
  if (channelAlarmMap.motion_alarm && Object.hasOwn(EVENT_CODE_MAP, 'motion_alarm')) {
    return {
      code: EVENT_CODE_MAP['motion_alarm' as keyof typeof EVENT_CODE_MAP],
      type: 'motion_alarm'
    };
  }
  
  const intSubtype = channelAlarmMap.int_alarm?.int_subtype;

  if (intSubtype && Object.hasOwn(EVENT_CODE_MAP, intSubtype)) {
    return {
      code: EVENT_CODE_MAP[intSubtype as keyof typeof EVENT_CODE_MAP],
      type: intSubtype
    };
  }
  
  return null;
};

const processAlarmMap = async (
  deviceNamePartList: string[],
  alarmMap: IAlarmMap.IAlarmMap,
  networkMap: INetworkMap.INetworkMap, 
): Promise<void> => {
  const httpClientInstance = new HttpClientUtil.HttpClient();

  httpClientInstance.setAuthenticationStrategy(new BearerStrategy.BearerStrategy(process.env.SIGMA_CLOUD_BEARER_TOKEN as string));
  
  const accountMap = (await httpClientInstance.get<IAccountMap.IAccountMap>(`https://api.segware.com.br/v5/accounts/${ deviceNamePartList[0] }`)).data;
  const partitionMap = accountMap?.partitions.find((partitionMap: IPartitionMap.IPartitionMap): boolean => String(partitionMap.id) === deviceNamePartList[1]);
  const account = accountMap?.accountCode ?? deviceNamePartList[1];

  if (!account) {
    return;
  }

  const companyId = accountMap?.companyId ?? Number(deviceNamePartList[0]);

  if (!companyId) {
    return;
  }

  const partition = partitionMap?.number ?? deviceNamePartList[2];

  if (!partition) {
    return;
  }

  await Promise.allSettled(
    alarmMap.channel_alarm.map(
      async (channelAlarmMap: IChannelAlarmMap.IChannelAlarmMap): Promise<void> => {
        const codeMap = fetchCodeMap(channelAlarmMap);

        if (codeMap) {
          try {
            await httpClientInstance.post<unknown>(
              'https://api.segware.com.br/v3/events/alarm', 
              { 
                events: [
                  {
                    account,
                    auxiliary: channelAlarmMap.channel,
                    code: codeMap.code,
                    companyId,
                    complement: `Fabricante: Gabriel, Tipo: ${ codeMap.type }, IP: ${ networkMap.ip }, MAC: ${ networkMap.mac }, Local: ${ channelAlarmMap.chn_alias }`,
                    eventId: EVENT_ID,
                    eventLog: `Fabricante: Gabriel, Tipo: ${ codeMap.type }, IP: ${ networkMap.ip }, MAC: ${ networkMap.mac }, Local: ${ channelAlarmMap.chn_alias }`,
                    partition,
                    protocolType: PROTOCOL_TYPE
                  }
                ] 
              }
            );

            await prisma.sigma_cloud_alarm_events.create(
              {
                data: {
                  application_type: 'sigma-cloud-gabriel-integration',
                  account,
                  auxiliary: channelAlarmMap.channel,
                  code: codeMap.code,
                  company_id: companyId,
                  complement: `Fabricante: Gabriel, Tipo: ${ codeMap.type }, IP: ${ networkMap.ip }, MAC: ${ networkMap.mac }, Local: ${ channelAlarmMap.chn_alias }`,
                  event_id: EVENT_ID,
                  event_log: `Fabricante: Gabriel, Tipo: ${ codeMap.type }, IP: ${ networkMap.ip }, MAC: ${ networkMap.mac }, Local: ${ channelAlarmMap.chn_alias }`,
                  partition,
                  protocol_type: PROTOCOL_TYPE,
                  status: 'sent'
                }
              }
            );
          } catch (error: unknown) {
            await prisma.sigma_cloud_alarm_events.create(
              {
                data: {
                  application_type: 'sigma-cloud-gabriel-integration',
                  account,
                  auxiliary: channelAlarmMap.channel,
                  code: codeMap.code,
                  company_id: companyId,
                  complement: `Fabricante: Gabriel, Tipo: ${ codeMap.type }, IP: ${ networkMap.ip }, MAC: ${ networkMap.mac }, Local: ${ channelAlarmMap.chn_alias }`,
                  event_id: EVENT_ID,
                  event_log: `Fabricante: Gabriel, Tipo: ${ codeMap.type }, IP: ${ networkMap.ip }, MAC: ${ networkMap.mac }, Local: ${ channelAlarmMap.chn_alias }`,
                  partition,
                  protocol_type: PROTOCOL_TYPE,
                  status: 'failed'
                }
              }
            );
          }
        }
      }
    )
  );
};

export const createSigmaCloudEvents = async (req: Request): Promise<IResponse.IResponse<string | IResponseData.IResponseData>> => {
  const body = req.body as IReqBody.ICreateSigmaCloudEventsReqBody;
  const alarmMapList = body?.data?.alarm_list;

  if (!alarmMapList) {
    return {
      status: 400,
      data: {
        message: 'Invalid request body.',
        suggestion: 'Please ensure the request body contains a valid "data.alarm_list" field.'
      }
    };
  }

  if (!alarmMapList.length) {
    return {
      status: 200,
      data: 'OK'
    };
  }

  await Promise.allSettled(alarmMapList.map((alarmMap: IAlarmMap.IAlarmMap): Promise<void> => processAlarmMap(body.data.device_name.split('_'), alarmMap, body.data.dev_net_info[0])));

  return {
    status: 200,
    data: 'OK'
  };
};
