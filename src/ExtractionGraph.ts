import { IExtractionPolicy } from "./types";
import yaml from "yaml";

class ExtractionGraph {
  id?: string;
  name: string;
  namespace?: string;
  extraction_policies: IExtractionPolicy[];

  constructor({
    id,
    name,
    namespace,
    extraction_policies,
  }: {
    id?: string;
    name: string;
    namespace?: string;
    extraction_policies: IExtractionPolicy[];
  }) {
    this.id = id;
    this.name = name;
    this.namespace = namespace;
    this.extraction_policies = extraction_policies;
  }

  static fromDict(json: Record<string, any>): ExtractionGraph {
    if ("namespace" in json) {
      delete json["namespace"];
    }
    return new ExtractionGraph({
      id: json.id,
      name: json.name,
      extraction_policies: json.extraction_policies,
    });
  }

  static fromYaml(spec: string): ExtractionGraph {
    const json = yaml.parse(spec);
    return ExtractionGraph.fromDict(json);
  }

  toDict(): Record<string, any> {
    const filteredDict: Record<string, any> = {};
    for (const key in this) {
      if (this[key] !== null && this[key] !== undefined) {
        filteredDict[key] = this[key];
      }
    }
    return filteredDict;
  }
}

export default ExtractionGraph;
