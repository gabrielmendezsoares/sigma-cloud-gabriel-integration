export interface IChannelAlarmMap {
  channel: string;
  chn_alias: string;
  motion_alarm?: boolean;
  int_alarm?: { int_subtype: string; };
}
