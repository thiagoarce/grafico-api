const express=require('express');
const cors=require('cors');
const{ChartJSNodeCanvas}=require('chartjs-node-canvas');

const app=express();
const port=process.env.PORT||3000;
app.use(cors());

const chart=new ChartJSNodeCanvas({width:1200,height:680});

const text=v=>v==null?'':String(v).trim();
const num=v=>{if(v==null||v==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null};
const bool=(v,d)=>{if(v==null||v==='')return d;const s=String(v).trim().toLowerCase();if(['1','true','sim','yes','on'].includes(s))return true;if(['0','false','nao','não','no','off'].includes(s))return false;return d};
const csv=v=>{const s=text(v);return s?s.split(',').map(x=>x.trim()):[]};
const csvn=v=>csv(v).map(num);
const safe=v=>text(v).replace(/</g,'&lt;').replace(/>/g,'&gt;');
const yx=y=>Number(y)*12;
const mx=v=>{const m=text(v).match(/^(\d{4})-(\d{1,2})$/);if(!m)return null;const y=+m[1],mo=+m[2];return Number.isInteger(y)&&mo>=1&&mo<=12?y*12+mo-1:null};
const xlabel=(x,months)=>{const n=Math.round(+x),y=Math.floor(n/12),m=n%12;return months?`${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][m]}/${String(y).slice(-2)}`:String(y)};
const valid=a=>a.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));

function annualPoints(ys,vs){
  const y=csv(ys),v=csvn(vs),out=[];
  for(let i=0;i<Math.min(y.length,v.length);i++){const yy=+y[i];if(Number.isInteger(yy)&&Number.isFinite(v[i]))out.push({x:yx(yy),y:v[i]})}
  return out;
}
function monthlyPoints(ms,vs){
  const m=csv(ms),v=csvn(vs),out=[];
  for(let i=0;i<Math.min(m.length,v.length);i++){const x=mx(m[i]);if(Number.isFinite(x)&&Number.isFinite(v[i]))out.push({x,y:v[i]})}
  return out.sort((a,b)=>a.x-b.x);
}
function projectionPoints(ys,vs,by,bv){
  const out=[];if(Number.isFinite(by)&&Number.isFinite(bv))out.push({x:yx(by),y:bv});
  return out.concat(annualPoints(ys,vs));
}
function movingAverage(points,w=6){
  return points.map((p,i)=>{const s=points.slice(Math.max(0,i-w+1),i+1).filter(q=>Number.isFinite(q.y));return{x:p.x,y:s.length?s.reduce((a,q)=>a+q.y,0)/s.length:null}})
}
function regression(points){
  const p=valid(points);if(p.length<2)return[];
  const n=p.length,sx=p.reduce((a,q)=>a+q.x,0),sy=p.reduce((a,q)=>a+q.y,0),sxy=p.reduce((a,q)=>a+q.x*q.y,0),sxx=p.reduce((a,q)=>a+q.x*q.x,0),d=n*sxx-sx*sx;
  if(Math.abs(d)<1e-12)return[];
  const slope=(n*sxy-sx*sy)/d,intercept=(sy-slope*sx)/n,min=Math.min(...p.map(q=>q.x)),max=Math.max(...p.map(q=>q.x));
  return[{x:min,y:intercept+slope*min},{x:max,y:intercept+slope*max}];
}
const add=(a,ok,d)=>{if(ok&&d.data&&d.data.length)a.push(d)};

async function legacy(req,res){
  const{assistencias,publicadores,congregacao}=req.query;
  if(!assistencias||!publicadores||!congregacao)return res.status(400).send('Parâmetros "assistencias", "publicadores" e "congregacao" são necessários.');
  const aa=assistencias.split(',').map(Number),pp=publicadores.split(',').map(Number),anos=[];for(let y=1998;y<=2024;y++)anos.push(y);
  if(aa.length!==anos.length||pp.length!==anos.length)return res.status(400).send('O número de valores de assistências e publicadores deve corresponder aos anos de 1998 a 2024.');
  const cfg={type:'line',data:{labels:anos,datasets:[
    {label:'Número de Assistências',data:aa,borderColor:'rgba(54, 162, 235, 1)',backgroundColor:'rgba(54, 162, 235, 0.2)',fill:false,tension:.1,pointRadius:5,pointHoverRadius:7},
    {label:'Número de Publicadores',data:pp,borderColor:'rgba(255, 99, 132, 1)',backgroundColor:'rgba(255, 99, 132, 0.2)',fill:false,tension:.1,pointRadius:5,pointHoverRadius:7}
  ]},options:{responsive:false,plugins:{title:{display:true,text:`${safe(congregacao)} (1998-2024)`,font:{size:20}},tooltip:{mode:'index',intersect:false},legend:{display:true,position:'top'}},interaction:{mode:'nearest',axis:'x',intersect:false},scales:{y:{beginAtZero:true,title:{display:true,text:'Quantidade'}},x:{title:{display:true,text:'Ano'}}}}};
  res.type('png').send(await chart.renderToBuffer(cfg));
}

async function v2(req,res){
  const q=req.query;
  const annualA=annualPoints(q.anos_anuais,q.assistencias_anuais);
  const annualP=annualPoints(q.anos_anuais,q.publicadores_anuais);
  const monthlyAll=monthlyPoints(q.meses,q.assistencias_mensais);
  const monthlyPAll=monthlyPoints(q.meses,q.publicadores_mensais);
  const baseYear=num(q.ano_base),baseA=num(q.assistencia_base);
  const p50=projectionPoints(q.anos_projecao,q.p50,baseYear,baseA),p70=projectionPoints(q.anos_projecao,q.p70,baseYear,baseA);
  const window=Math.max(6,Math.min(120,Math.round(num(q.janela_meses)||36)));
  const monthly=monthlyAll.slice(-window),monthlyP=monthlyPAll.slice(-window),ma=movingAverage(monthly,6);
  const histTrend=regression(annualA),recentTrend=regression(valid(ma).slice(-36));

  const show={
    annual:bool(q.anual,true),monthly:bool(q.mensal,true),publishers:bool(q.publicadores,false),
    ma:bool(q.media_movel,true),hist:bool(q.tend_hist,true),recent:bool(q.tend_rec,true),
    p50:bool(q.p50_visivel,true),p70:bool(q.p70_visivel,false)
  };

  const ds=[];
  add(ds,show.annual,{label:'Assistência anual',data:annualA,borderColor:'rgba(54,162,235,.95)',backgroundColor:'rgba(54,162,235,.12)',pointRadius:3,borderWidth:2,tension:.15,spanGaps:true});
  add(ds,show.annual&&show.publishers,{label:'Publicadores anuais',data:annualP,borderColor:'rgba(255,99,132,.75)',pointRadius:2,borderWidth:1.5,borderDash:[4,4],tension:.1});
  add(ds,show.monthly,{label:`Assistência mensal (últimos ${window} meses)`,data:monthly,borderColor:'rgba(75,192,192,.45)',pointRadius:1.5,borderWidth:1.5,tension:.15});
  add(ds,show.monthly&&show.ma,{label:'Média móvel 6 meses',data:valid(ma),borderColor:'rgba(0,128,128,1)',pointRadius:0,borderWidth:3,tension:.2});
  add(ds,show.monthly&&show.publishers,{label:`Publicadores mensais (últimos ${window} meses)`,data:monthlyP,borderColor:'rgba(255,99,132,.35)',pointRadius:1,borderWidth:1,borderDash:[3,3],tension:.1});
  add(ds,show.hist,{label:'Tendência histórica',data:histTrend,borderColor:'rgba(99,99,99,.95)',pointRadius:0,borderWidth:2,borderDash:[10,6]});
  add(ds,show.recent,{label:'Tendência recente',data:recentTrend,borderColor:'rgba(255,159,64,1)',pointRadius:0,borderWidth:3,borderDash:[8,4]});
  add(ds,show.p50,{label:'Projeção P50',data:p50,borderColor:'rgba(153,102,255,1)',pointRadius:3,borderWidth:3,borderDash:[6,4],tension:.15});
  add(ds,show.p70,{label:'Projeção P70',data:p70,borderColor:'rgba(201,90,208,1)',pointRadius:3,borderWidth:2.5,borderDash:[3,4],tension:.15});
  if(!ds.length)return res.status(400).send('Nenhuma série foi habilitada para o gráfico.');

  const subtitle=[];
  if(text(q.classe_tendencia))subtitle.push(`Modelo hierárquico: ${safe(q.classe_tendencia)}`);
  const inc=num(q.inclinacao_5_anos);if(Number.isFinite(inc))subtitle.push(`Inclinação 5 anos: ${inc>0?'+':''}${inc.toFixed(1)} pessoas/ano`);
  if(Number.isFinite(baseYear))subtitle.push(`Ano base: ${Math.round(baseYear)}`);
  if(text(q.versao_modelo))subtitle.push(`Modelo: ${safe(q.versao_modelo)}`);

  const xs=ds.flatMap(d=>d.data||[]).filter(p=>p&&Number.isFinite(p.x)).map(p=>p.x),min=xs.length?Math.min(...xs):undefined,max=xs.length?Math.max(...xs):undefined;
  const monthTicks=Number.isFinite(min)&&Number.isFinite(max)?max-min<=84:false;

  const cfg={type:'line',data:{datasets:ds},options:{
    responsive:false,parsing:false,animation:false,normalized:true,
    plugins:{
      title:{display:true,text:safe(q.congregacao||q.nome_congregacao)||'Evolução da congregação',font:{size:20},padding:{top:10,bottom:4}},
      subtitle:{display:subtitle.length>0,text:subtitle.join('  |  '),font:{size:13},padding:{bottom:12}},
      legend:{display:true,position:'top',labels:{boxWidth:28,padding:14}},
      tooltip:{mode:'nearest',intersect:false,callbacks:{title:items=>items&&items.length?xlabel(items[0].parsed.x,true):''}}
    },
    interaction:{mode:'nearest',axis:'x',intersect:false},
    scales:{
      x:{type:'linear',min,max,title:{display:true,text:monthTicks?'Mês / Ano':'Ano'},ticks:{callback:v=>xlabel(v,monthTicks),maxTicksLimit:monthTicks?14:12}},
      y:{beginAtZero:false,title:{display:true,text:'Pessoas'},grace:'8%'}
    }
  }};

  res.set('Cache-Control','public, max-age=300');
  res.type('png').send(await chart.renderToBuffer(cfg));
}

app.get('/api/grafico',async(req,res)=>{
  try{
    const isV2=Boolean(req.query.anos_anuais||req.query.meses||req.query.anos_projecao||req.query.classe_tendencia);
    return isV2?await v2(req,res):await legacy(req,res);
  }catch(e){console.error(e);return res.status(500).send('Erro ao gerar o gráfico.')}
});

app.get('/health',(req,res)=>res.json({ok:true,service:'grafico-api',version:'2.0.0'}));
app.listen(port,()=>console.log(`API rodando em http://localhost:${port}`));
