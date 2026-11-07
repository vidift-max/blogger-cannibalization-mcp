const STOP = new Set('the a an and or for to of in on with from by is are how what when your you best guide review vs'.split(' '));
const words = s => (s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]{3,}/g) || []).filter(w => !STOP.has(w));
const set = s => new Set(words(s));
const jaccard = (a,b) => { const A=set(a), B=set(b); if(!A.size || !B.size) return 0; let n=0; for(const x of A) if(B.has(x)) n++; return n/(A.size+B.size-n); };
export function analyzePosts(posts) {
  const findings=[];
  for(let i=0;i<posts.length;i++) for(let j=i+1;j<posts.length;j++) {
    const a=posts[i], b=posts[j];
    const title=jaccard(a.title||'',b.title||'');
    const body=jaccard((a.title||'')+' '+(a.content_text||''),(b.title||'')+' '+(b.content_text||''));
    const score=Number((title*.65+body*.35).toFixed(3));
    if(score>=0.18) findings.push({score,risk:score>=0.55?'CRITICAL':score>=0.36?'HIGH':score>=0.25?'MEDIUM':'LOW',posts:[{id:a.id,title:a.title,url:a.url},{id:b.id,title:b.title,url:b.url}],shared_terms:[...set(a.title||'')].filter(x=>set(b.title||'').has(x)).slice(0,12),recommendation:score>=0.36?'Avaliar uma página principal e diferenciar ou consolidar a outra.':'Revisar intenção de busca, títulos e subtópicos.'});
  }
  return findings.sort((a,b)=>b.score-a.score);
}
