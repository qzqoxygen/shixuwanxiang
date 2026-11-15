import type { AnswerEvidence } from "@/lib/contracts/ai-evidence";
import type { RetrievalDiagnostic } from "@/lib/contracts/retrieval";
import { SOLAR_TERMS } from "@/lib/solar-terms";

const strategies: Record<string, string> = {
  exact_title: "案例名称匹配", alias: "俗称与同义表达匹配", ranked: "联合条件与相关性匹配",
  filters_only: "按节气与地区筛选", not_cultural: "基础知识问题", no_match: "未找到匹配案例", comparison: "分地区比较",
};

export default function AnswerEvidence({ evidence, diagnostics = [] }: { evidence: AnswerEvidence; diagnostics?: RetrievalDiagnostic[] }) {
  return <section className="chat-answer-evidence" aria-label="回答依据">
    <div className="chat-evidence-kinds">
      {evidence.localCases.length > 0 && <span>本地已核验案例 · {evidence.localCases.length}</span>}
      {evidence.searchStatus === "available" && <span>本轮联网资料 · {evidence.webSources.length}</span>}
      {evidence.searchStatus === "failed" && <span>本轮联网未成功</span>}
      {evidence.kinds.includes("insufficient_evidence") && <span>部分内容缺少可核实依据</span>}
      <span>模型解释需结合原文判断</span>
    </div>
    <details>
      <summary>查看回答依据与检索说明</summary>
      {evidence.localCases.length > 0 && <div>
        <h4>本轮检索的文化案例</h4>
        <ul>{evidence.localCases.map(item => <li key={item.caseId}>
          <strong>[案例{item.citation}] {item.title}</strong>
          <p>{item.provinceName} · {item.regionName} · {item.solarTermIds.map(id => SOLAR_TERMS.find(term => term.id === id)?.name).join("、")}</p>
          <span>{item.cited ? "本回答已引用" : "已检索，未在正文引用"}</span>
          {item.sources.map(source => <div key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>{source.accessNote && <small>{source.accessNote}</small>}</div>)}
        </li>)}</ul>
      </div>}
      {evidence.webSources.length > 0 && <div>
        <h4>本轮实时联网来源</h4>
        <ul>{evidence.webSources.map(source => <li key={source.citation}>
          <a href={source.url} target="_blank" rel="noopener noreferrer">[{source.citation}] {source.title}</a>
          <span>{source.cited ? "本回答已引用" : "已检索，未在正文引用"}</span>
        </li>)}</ul>
      </div>}
      {!evidence.localCases.length && !evidence.webSources.length && <p>本回答没有可关联的本地案例或本轮联网来源，属于一般知识或无法核实的说明。</p>}
      {diagnostics.length > 0 && <div>
        <h4>检索说明</h4>
        <ul>{diagnostics.map((item, index) => <li key={index}>
          {strategies[item.strategy] ?? "本地知识库检索"} · 匹配 {item.matchedCount} 则，本轮取用 {item.matchedIds.length} 则
          {item.matchedAliases.length > 0 && <p>识别表达：{item.matchedAliases.join("、")}</p>}
          {item.noMatchReason && <p>当前收录资料无法满足这些条件，不表示当地没有相关文化。</p>}
        </li>)}</ul>
      </div>}
      <p className="chat-evidence-limit">{evidence.limitation}</p>
    </details>
  </section>;
}
