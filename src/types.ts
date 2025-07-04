export interface MoleHole {
  name: string;
  targetHost: string;
  targetPort: number;
  localPort: number;
  bastion?: string;
  pid: number;
}
