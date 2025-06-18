import { IChannelAlarmMap } from "./index.js";

export interface IAlarmMap {
  time: string;
  channel_alarm: IChannelAlarmMap.IChannelAlarmMap[];
}
