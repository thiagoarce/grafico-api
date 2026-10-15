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
const xlabel=(x,months)=>{const n=Math.round(+x),y=Math.floor(n/12),m=((n%12)+12)%12;return months?`${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][m]}/${String(y).slice(-2)}`:String(y)};
const valid=a=>a.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
const fmt1=n=>Number.isFinite(n)?n.toFixed(1).replace('.',','):'—';

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
  const out=[];
  if(Number.isFinite(by)&&Number.isFinite(bv))out.push({x:yx(by),y:bv});
  return out.concat(annualPoints(ys,vs));
}

function movingAverage(points,w=6){
  return points.map((p,i)=>{
    const s=points.slice(Math.max(0,i-w+1),i+1).filter(q=>Number.isFinite(q.y));
    return{x:p.x,y:s.length?s.reduce((a,q)=>a+q.y,0)/s.length:null};
  });
}

function regressionMeta(points){
  const p=valid(points);
  if(p.length<2)return{points:[],slopeYear:null};
  const n=p.length;
  const sx=p.reduce((a,q)=>a+q.x,0),sy=p.reduce((a,q)=>a+q.y,0);
  const sxy=p.reduce((a,q)=>a+q.x*q.y,0),sxx=p.reduce((a,q)=>a+q.x*q.x,0);
  const d=n*sxx-sx*sx;
  if(Math.abs(d)<1e-12)return{points:[],slopeYear:null};
  const slope=(n*sxy-sx*sy)/d,intercept=(sy-slope*sx)/n;
  const min=Math.min(...p.map(q=>q.x)),max=Math.max(...p.map(q=>q.x));
  return{
    points:[{x:min,y:intercept+slope*min},{x:max,y:intercept+slope*max}],
    slopeYear:slope*12
  };
}

const add=(a,ok,d)=>{if(ok&&d.data&&d.data.length)a.push(d)};

async function legacy(req,res){
  const{assistencias,publicadores,congregacao}=req.query;
  if(!assistencias||!publicadores||!congregacao)return res.status(400).send('Parâmetros "assistencias", "publicadores" e "congregacao" são necessários.');
  const aa=assistencias.split(',').map(Number),pp=publicadores.split(',').map(Number),anos=[];
  for(let y=1998;y<=2024;y++)anos.push(y);
  if(aa.length!==anos.length||pp.length!==anos.length)return res.status(400).send('O número de valores de assistências e publicadores deve corresponder aos anos de 1998 a 2024.');

  const cfg={
    type:'line',
    data:{labels:anos,datasets:[
      {label:'Número de Assistências',data:aa,borderColor:'rgba(54, 162, 235, 1)',backgroundColor:'rgba(54, 162, 235, 0.2)',fill:false,tension:.1,pointRadius:5,pointHoverRadius:7},
      {label:'Número de Publicadores',data:pp,borderColor:'rgba(255, 99, 132, 1)',backgroundColor:'rgba(255, 99, 132, 0.2)',fill:false,tension:.1,pointRadius:5,pointHoverRadius:7}
    ]},
    options:{
      responsive:false,
      plugins:{
        title:{display:true,text:`${safe(congregacao)} (1998-2024)`,font:{size:20}},
        tooltip:{mode:'index',intersect:false},
        legend:{display:true,position:'top'}
      },
      interaction:{mode:'nearest',axis:'x',intersect:false},
      scales:{
        y:{beginAtZero:true,title:{display:true,text:'Quantidade'}},
        x:{title:{display:true,text:'Ano'}}
      }
    }
  };
  res.type('png').send(await chart.renderToBuffer(cfg));
}

async function v2(req,res){
  const q=req.query;
  const mode=['geral','recente','detalhado'].includes(text(q.modo).toLowerCase())?text(q.modo).toLowerCase():'geral';

  const annualA=annualPoints(q.anos_anuais,q.assistencias_anuais);
  const annualP=annualPoints(q.anos_anuais,q.publicadores_anuais);
  const monthlyAll=monthlyPoints(q.meses,q.assistencias_mensais);
  const monthlyPAll=monthlyPoints(q.meses,q.publicadores_mensais);

  const baseYear=num(q.ano_base),baseA=num(q.assistencia_base);
  const p50All=projectionPoints(q.anos_projecao,q.p50,baseYear,baseA);
  const p70All=projectionPoints(q.anos_projecao,q.p70,baseYear,baseA);

  const window=Math.max(6,Math.min(120,Math.round(num(q.janela_meses)||36)));
  const monthly=monthlyAll.slice(-window);
  const monthlyP=monthlyPAll.slice(-window);
  const ma=valid(movingAverage(monthly,6));

  const histMeta=regressionMeta(annualA);
  const recentMeta=regressionMeta(ma.slice(-36));

  const recentProjectionMax=Number.isFinite(baseYear)?yx(baseYear+5):Infinity;
  const p50=mode==='recente'?p50All.filter(p=>p.x<=recentProjectionMax):p50All;
  const p70=mode==='recente'?p70All.filter(p=>p.x<=recentProjectionMax):p70All;

  const defaults={
    geral:{annual:true,monthly:false,ma:false,hist:false,recent:false,p50:true,p70:false,publishers:false},
    recente:{annual:false,monthly:false,ma:true,hist:false,recent:false,p50:true,p70:false,publishers:false},
    detalhado:{annual:true,monthly:true,ma:true,hist:true,recent:true,p50:true,p70:false,publishers:false}
  }[mode];

  const show={
    annual:bool(q.anual,defaults.annual),
    monthly:bool(q.mensal,defaults.monthly),
    publishers:bool(q.publicadores,defaults.publishers),
    ma:bool(q.media_movel,defaults.ma),
    hist:bool(q.tend_hist,defaults.hist),
    recent:bool(q.tend_rec,defaults.recent),
    p50:bool(q.p50_visivel,defaults.p50),
    p70:bool(q.p70_visivel,defaults.p70)
  };

  const ds=[];

  add(ds,show.annual,{
    label:'Histórico anual',
    data:annualA,
    borderColor:'rgba(41,128,185,1)',
    backgroundColor:'rgba(41,128,185,.10)',
    pointBackgroundColor:'rgba(41,128,185,1)',
    pointRadius:2.5,
    pointHoverRadius:5,
    borderWidth:2.5,
    tension:.18,
    spanGaps:true
  });

  add(ds,show.annual&&show.publishers,{
    label:'Publicadores anuais',
    data:annualP,
    borderColor:'rgba(127,140,141,.65)',
    pointRadius:1.5,
    borderWidth:1.4,
    borderDash:[4,4],
    tension:.12
  });

  add(ds,show.monthly,{
    label:'Dados mensais',
    data:monthly,
    borderColor:'rgba(39,174,96,.22)',
    pointBackgroundColor:'rgba(39,174,96,.30)',
    pointRadius:1,
    borderWidth:1,
    tension:.18
  });

  add(ds,show.ma,{
    label:'Movimento recente',
    data:ma,
    borderColor:'rgba(22,160,133,1)',
    backgroundColor:'rgba(22,160,133,.08)',
    pointRadius:0,
    borderWidth:4,
    tension:.22
  });

  add(ds,show.monthly&&show.publishers,{
    label:'Publicadores mensais',
    data:monthlyP,
    borderColor:'rgba(127,140,141,.28)',
    pointRadius:0,
    borderWidth:1,
    borderDash:[3,3],
    tension:.1
  });

  add(ds,show.hist,{
    label:'Tendência de longo prazo',
    data:histMeta.points,
    borderColor:'rgba(99,99,99,.80)',
    pointRadius:0,
    borderWidth:2,
    borderDash:[10,6]
  });

  add(ds,show.recent,{
    label:'Tendência recente',
    data:recentMeta.points,
    borderColor:'rgba(230,126,34,.90)',
    pointRadius:0,
    borderWidth:2.5,
    borderDash:[7,4]
  });

  add(ds,show.p50,{
    label:'Projeção central',
    data:p50,
    borderColor:'rgba(108,92,231,1)',
    backgroundColor:'rgba(108,92,231,.06)',
    pointBackgroundColor:'rgba(108,92,231,1)',
    pointRadius:2.5,
    pointHoverRadius:5,
    borderWidth:3,
    borderDash:[7,5],
    tension:.16
  });

  add(ds,show.p70,{
    label:'Cenário de planejamento',
    data:p70,
    borderColor:'rgba(162,155,254,.95)',
    pointRadius:2,
    borderWidth:2,
    borderDash:[3,5],
    tension:.16
  });

  if(!ds.length)return res.status(400).send('Nenhuma série foi habilitada para o gráfico.');

  const currentX=monthlyAll.length
    ? monthlyAll[monthlyAll.length-1].x
    : Number.isFinite(baseYear)?yx(baseYear):annualA.length?annualA[annualA.length-1].x:null;

  const longText=Number.isFinite(histMeta.slopeYear)?`${histMeta.slopeYear>=0?'+':''}${fmt1(histMeta.slopeYear)}/ano`:'—';
  const recentText=Number.isFinite(recentMeta.slopeYear)?`${recentMeta.slopeYear>=0?'+':''}${fmt1(recentMeta.slopeYear)}/ano`:'—';
  const modelText=text(q.classe_tendencia)||'sem classificação';

  const subtitle=[
    `Longo prazo: ${longText}`,
    `Recente: ${recentText}`,
    `Modelo: ${safe(modelText)}`
  ];

  if(Number.isFinite(baseYear))subtitle.push(`Ano base: ${Math.round(baseYear)}`);

  const xs=ds.flatMap(d=>d.data||[]).filter(p=>p&&Number.isFinite(p.x)).map(p=>p.x);
  let min=xs.length?Math.min(...xs):undefined;
  let max=xs.length?Math.max(...xs):undefined;

  if(mode==='recente'){
    const recentXs=[...monthly.map(p=>p.x),...ma.map(p=>p.x),...p50.map(p=>p.x),...p70.map(p=>p.x)].filter(Number.isFinite);
    if(recentXs.length){min=Math.min(...recentXs);max=Math.max(...recentXs)}
  }

  const monthTicks=mode==='recente'||(Number.isFinite(min)&&Number.isFinite(max)&&max-min<=84);

  const backgroundPlugin={
    id:'background',
    beforeDraw(chart){
      const{ctx,width,height}=chart;
      ctx.save();
      ctx.fillStyle='#ffffff';
      ctx.fillRect(0,0,width,height);
      ctx.restore();
    }
  };

  const futurePlugin={
    id:'futureArea',
    beforeDatasetsDraw(chart){
      if(!Number.isFinite(currentX))return;
      const{ctx,chartArea,scales}=chart;
      const px=scales.x.getPixelForValue(currentX);
      if(!Number.isFinite(px))return;
      ctx.save();
      if(px<chartArea.right){
        ctx.fillStyle='rgba(108,92,231,.035)';
        ctx.fillRect(Math.max(px,chartArea.left),chartArea.top,chartArea.right-Math.max(px,chartArea.left),chartArea.bottom-chartArea.top);
      }
      ctx.strokeStyle='rgba(90,90,90,.55)';
      ctx.lineWidth=1.2;
      ctx.setLineDash([5,5]);
      ctx.beginPath();
      ctx.moveTo(px,chartArea.top);
      ctx.lineTo(px,chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle='rgba(70,70,70,.85)';
      ctx.font='600 12px sans-serif';
      ctx.textAlign='center';
      ctx.fillText('ATUAL',px,chartArea.top-8);
      ctx.restore();
    }
  };

  const modeTitle=mode==='recente'?'Evolução recente e projeção':mode==='detalhado'?'Visão detalhada':'Histórico e projeção';

  const cfg={
    type:'line',
    data:{datasets:ds},
    plugins:[backgroundPlugin,futurePlugin],
    options:{
      responsive:false,
      parsing:false,
      animation:false,
      normalized:true,
      layout:{padding:{top:12,right:24,bottom:8,left:12}},
      plugins:{
        title:{
          display:true,
          text:[safe(q.congregacao||q.nome_congregacao)||'Congregação',modeTitle],
          font:{size:21,weight:'600'},
          color:'#263238',
          padding:{top:6,bottom:6}
        },
        subtitle:{
          display:true,
          text:subtitle.join('   •   '),
          font:{size:13,weight:'500'},
          color:'#607d8b',
          padding:{bottom:12}
        },
        legend:{
          display:true,
          position:'top',
          labels:{
            boxWidth:22,
            boxHeight:3,
            padding:18,
            usePointStyle:false,
            color:'#455a64',
            font:{size:12}
          }
        },
        tooltip:{
          mode:'nearest',
          intersect:false,
          backgroundColor:'rgba(38,50,56,.94)',
          padding:10,
          callbacks:{
            title:items=>items&&items.length?xlabel(items[0].parsed.x,true):''
          }
        }
      },
      interaction:{mode:'nearest',axis:'x',intersect:false},
      scales:{
        x:{
          type:'linear',
          min,
          max,
          grid:{color:'rgba(0,0,0,.045)',drawBorder:false},
          title:{display:true,text:monthTicks?'Mês / Ano':'Ano',color:'#607d8b'},
          ticks:{
            color:'#607d8b',
            callback:v=>xlabel(v,monthTicks),
            maxTicksLimit:monthTicks?12:11,
            padding:6
          }
        },
        y:{
          beginAtZero:false,
          grace:'10%',
          grid:{color:'rgba(0,0,0,.055)',drawBorder:false},
          title:{display:true,text:'Assistência',color:'#607d8b'},
          ticks:{color:'#607d8b',padding:6}
        }
      }
    }
  };

  res.set('Cache-Control','public, max-age=300');
  res.type('png').send(await chart.renderToBuffer(cfg));
}

app.get('/api/grafico',async(req,res)=>{
  try{
    const isV2=Boolean(req.query.anos_anuais||req.query.meses||req.query.anos_projecao||req.query.classe_tendencia);
    return isV2?await v2(req,res):await legacy(req,res);
  }catch(e){
    console.error(e);
    return res.status(500).send('Erro ao gerar o gráfico.');
  }
});

app.get('/health',(req,res)=>res.json({ok:true,service:'grafico-api',version:'2.1.0'}));
app.listen(port,()=>console.log(`API rodando em http://localhost:${port}`));
