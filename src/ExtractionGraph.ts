import { IExtractionPolicy } from "./types";
import yaml from "yaml";

class ExtractionGraph {
  constructor(
    public readonly name: string,
    public readonly extraction_policies: IExtractionPolicy[],
    public readonly id?: string,
    public readonly namespace?: string
  ) {}

  static fromDict(json: Record<string, any>): ExtractionGraph {
    const { id, name, extraction_policies, ...rest } = json;
    return new ExtractionGraph(name, extraction_policies, id);
  }

  static fromYaml(spec: string): ExtractionGraph {
    return ExtractionGraph.fromDict(yaml.parse(spec));
  }

  toDict(): Record<string, any> {
    return Object.fromEntries(
      Object.entries(this).filter(([_, value]) => value != null)
    );
  }
}

export default ExtractionGraph;
