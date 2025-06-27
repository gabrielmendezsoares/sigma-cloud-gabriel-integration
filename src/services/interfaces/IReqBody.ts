import { IAlarmMap, INetworkMap } from "./index.js";

export interface ICreateSigmaCloudEventsReqBody {
  data: {
    alarm_list?: IAlarmMap.IAlarmMap[];
    device_name: string;
    dev_net_info: INetworkMap.INetworkMap[];
  };
}
