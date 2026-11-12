import Image from "next/image";
import { SOLAR_TERMS } from "@/lib/solar-terms";
import type { CulturalCategory, VerifiedCulturalCase } from "@/lib/contracts/cultural-case";

export const CATEGORY_LABELS: Record<CulturalCategory, string> = { folk_custom: "民俗", agriculture: "农事", craft: "技艺", food: "饮食", other: "其他" };

export default function CulturalCaseContent({ item }: { item: VerifiedCulturalCase }) {
  return <>
    <p className="case-detail-meta">{item.provinceName} · {item.regionName} · {CATEGORY_LABELS[item.category]} · {SOLAR_TERMS.filter(term => item.solarTermIds.includes(term.id)).map(term => term.name).join(" · ")}</p>
    {item.imageUrl && <Image className="case-detail-image" src={item.imageUrl} alt={item.title} width={720} height={480} />}
    <p className="case-detail-description">{item.description}</p>
    <h4 className="case-detail-section-title">节气关联</h4><p className="case-detail-relation">{item.relationNote}</p>
    <div className="case-sources"><h4 className="case-detail-section-title">资料来源</h4><ul>{item.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <span aria-hidden="true">↗</span></a>{source.publisher && <span>{source.publisher}</span>}{source.accessNote && <span>{source.accessNote}</span>}</li>)}</ul></div>
  </>;
}
