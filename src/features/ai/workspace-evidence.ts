export type EvidenceSource={ref:string;title:string;path:string;kind:string;body?:string;status?:string;person?:string;at?:string}
export function readAnswer(text:string,sources:EvidenceSource[]){
 let value:unknown;try{value=JSON.parse(text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))}catch{throw Error('The answer could not be read. Try asking again.')}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('The answer could not be read.')
 const v=value as {answer?:unknown;citations?:unknown};if(typeof v.answer!=='string'||!v.answer.trim())throw Error('No answer was returned.')
 const refs=Array.isArray(v.citations)?new Set(v.citations.filter(x=>typeof x==='string')):new Set();return {answer:v.answer,sources:sources.filter(s=>refs.has(s.ref)&&s.path.startsWith('/app/')&&!s.path.startsWith('//'))}
}
