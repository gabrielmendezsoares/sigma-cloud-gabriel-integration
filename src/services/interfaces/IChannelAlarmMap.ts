export interface IChannelAlarmMap {
  channel: string;
  chn_alias: string;
  int_alarm?: { int_subtype: string; };
  motion_alarm?: boolean;
}
