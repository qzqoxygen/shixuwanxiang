import data from "../../data/cultural-cases/cases.json" with { type: "json" };
import { CulturalCaseCollectionSchema } from "../contracts/cultural-case";

// Validate the complete local collection, including pending records, on every read.
// Query helpers are the sole public selection path; drafts are kept outside this data.
export function readCulturalCases() {
  return CulturalCaseCollectionSchema.parse(data);
}
