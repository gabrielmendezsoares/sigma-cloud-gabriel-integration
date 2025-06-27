import { IAlarmMap, INetworkMap } from "./index.js";

export interface ICreateSigmaCloudEventsReqBody {
  data: {
    alarm_list?: IAlarmMap.IAlarmMap[];
    dev_net_info: INetworkMap.INetworkMap[];
    device_name: string;
  };
}
