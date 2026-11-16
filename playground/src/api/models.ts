export interface Member {
  name: string;
  type: string;
  optional?: boolean;
  description: string;
}
export interface Parameter extends Member {
  defaultValue: string | null;
  members: Member[];
}
export interface ApiSymbol {
  name: string;
  kind: string;
  description: string;
  type: string;
  signatures: string[];
  members: Member[];
  parameters: Parameter[];
  returns: Member[];
}
export interface ApiPage {
  id: string;
  package: string;
  module: string;
  source: string;
  declaration: string;
  symbols: ApiSymbol[];
  events?: Member[];
}
