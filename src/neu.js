/* ---------- Neuaufbau v30: Heute · Woche · Weg ---------- */
var DOFF=0,IOV={},HX={why:0,fuel:{}},HRLY={};
try{IOV=JSON.parse(localStorage.getItem('io1')||'{}')||{}}catch(e){}
var MOB=[['Hüftbeuger dehnen im Ausfallschritt','2 × 45 s je Seite'],['Waden an der Wand','2 × 45 s je Seite'],['Faszienrolle Oberschenkel vorne und außen','3 min'],['Katze-Kuh für den Rücken','10 langsame Wiederholungen'],['Brustwirbelsäule drehen in Seitlage','8 je Seite']];
function tod(){return iso(new Date())}
function wdOf(d){return['So','Mo','Di','Mi','Do','Fr','Sa'][new Date(d+'T12:00:00').getDay()]}
function wdLong(d){return['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][new Date(d+'T12:00:00').getDay()]}
function isWe(d){var g=new Date(d+'T12:00:00').getDay();return g===0||g===6}
function stT(d){return String((isWe(d)?CF.we:CF.wd)||'19:00').slice(0,5)}
function isBike(t){t=t||'';return/Zwift|SIT|VO2|30[/]30|GLA|Grundlage|Sweet|Schwelle|Intervall|Ausfahrt|Rennrad|\bRad\b|[45]×4|Tempo|Over|FTP/i.test(t)&&!/Lauf|Wanderung|Skitour|Schneeschuh|Ski\b/i.test(t)}
function minsOf(p){var t=(p&&p[2]||'')+' '+(p&&p[3]||''),m=/(\d+)\s*min/.exec(p&&p[2]||'')||/(\d+)\s*min/.exec(t),h=/(\d+(?:[,.]\d+)?)\s*(?:–|-|bis)?\s*(\d+(?:[,.]\d+)?)?\s*h\b/.exec(t);if(m)return Number(m[1]);if(h)return Math.round(Number(String(h[2]||h[1]).replace(',','.'))*60);return p&&p[1]?Math.round(p[1]/50*60):60}
function ioMode(t){return isZw(t)?'zw':outd(t)?'od':isBike(t)?'zw':null}
/* Vorschlag drinnen oder draußen: Trainingsart vor Wetter */
function ioSug(p,d){if(!p||!isBike(p[2]))return null;var t=p[2]+' '+(p[3]||''),mi=minsOf(p),f=wxDay(d),dy=f&&f.day||{},rp=dy.rainProbabilityValue||0,sp=dy.snowProbabilityValue||0,tx=dy.temperature,mo=Number(d.slice(5,7)),dark=!isWe(d)&&(mo>=10||mo<=3)&&Number(stT(d).slice(0,2))>=17,bad=rp>=60?'Regen '+rp+' %':sp>=40?'Schnee '+sp+' %':tx!=null&&tx<4?'nur '+Math.round(tx)+'°':'';
if(/SIT|Sprint|VO2|30[/]30|[45]×4|Schwelle|Over|Unter|FTP-Test|Intervall/i.test(t)&&!/Berg|Anstieg/i.test(t))return{m:'zw',why:'präzise Intervalle gehen auf Zwift genauer'};
if(dark)return{m:'zw',why:'um '+stT(d)+' ist es dunkel'};
if(/Ausfahrt|lang|Berg|Höhenmeter|Hm\b|Renn/i.test(t)||mi>=150)return bad?{m:'zw',why:bad+', lange Einheit lieber drinnen'}:{m:'od',why:'lange Einheit ist draußen wertvoller'};
if(mi<75)return{m:'zw',why:'kurze Einheit, drinnen effizienter'};
return bad?{m:'zw',why:bad}:{m:'od',why:'Wetter passt'+(tx!=null?', '+Math.round(tx)+'°':'')}}
function ioConv(p,m){var o=p.slice(),mi=minsOf(p),core=String(p[2]).replace(/^(Zwift[- ]?(Variante)?:?\s*)/i,'').replace(/^Ausfahrt( draußen)?:?\s*/i,'');
if(m==='zw'){var z=Math.max(45,Math.round(mi*.85/15)*15),hard=/SIT|VO2|Schwelle|Sweet|30[/]30|Intervall|[45]×4/i.test(core);o[2]='Zwift '+(hard?core:'GLA '+z+' min');o[3]='Indoor-Variante von „'+p[2]+'“'+(hard?'':': '+z+' min Zone 2 statt '+Math.round(mi)+' min draußen, gleiche Belastung.')+(p[3]?' '+p[3]:'')}
else{o[2]='Ausfahrt draußen: '+core;o[3]=(/SIT|Sprint/i.test(core)?'Sprints an einem leichten Anstieg oder auf gerader, verkehrsarmer Strecke. ':/VO2|Schwelle|Sweet|Intervall|[45]×4/i.test(core)?'Intervalle an einem gleichmäßigen Anstieg fahren, Watt statt Tempo im Blick. ':'Ruhig in Zone 2, Puls im Blick. ')+(p[3]||'')}
o._io=m;o._o=p;return o}
function ioApply(){Object.keys(IOV).forEach(function(d){var v=IOV[d],p=PM[d];if(!p||!v||v.t!==p[2])return;if(ioMode(p[2])===v.m)return;PM[d]=ioConv(p,v.m)})}
function ioSet(d,m){var p=PM[d],o=p&&p._o?p._o:p;if(!o)return;if(ioMode(o[2])===m)delete IOV[d];else IOV[d]={m:m,t:o[2]};try{localStorage.setItem('io1',JSON.stringify(IOV))}catch(e){}
if(DBH&&UID){var x=DBH.doc('data/users/'+UID+'/io_'+d);DBP(IOV[d]?x.set({day:d,m:m,t:o[2],ts:Date.now()}):x.delete(),'Drinnen/Draußen').catch(function(){})}
rpm();rall();try{if(window.WU&&WU.ivSync)setTimeout(function(){WU.ivSync(false)},300)}catch(e){}hToast(m==='zw'?'Auf Zwift umgestellt'+(window.WU_IVSTAT?', wird an Zwift übertragen':''):'Auf draußen umgestellt')}
var _rpmIO=rpm;rpm=function(){_rpmIO();try{ioApply()}catch(e){logErr('App','Drinnen/Draußen',e)}};
function ioHtml(d,p,cmp){if(!p||!isBike(p[2]))return'';var cur=p._io||ioMode(p[2]),s=ioSug(p._o||p,d);
return'<div class="io'+(cmp?' cmp':'')+'"><div class="ioseg" role="group" aria-label="Drinnen oder draußen"><button type="button" data-io="'+d+'|zw" aria-pressed="'+(cur==='zw')+'">🏠 Zwift</button><button type="button" data-io="'+d+'|od" aria-pressed="'+(cur==='od')+'">🌄 Draußen</button></div>'+(s&&s.m!==cur?'<span class="iosug">Vorschlag: '+(s.m==='zw'?'Zwift':'draußen')+', '+E(s.why)+'</span>':'')+'</div>'}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-io]');if(!b)return;e.stopPropagation();e.preventDefault();var q=b.getAttribute('data-io').split('|');ioSet(q[0],q[1])},true);

/* ---------- Bausteine ---------- */
function hToast(t){var x=$('htoast');if(!x){x=document.createElement('div');x.id='htoast';x.className='htoast';document.body.appendChild(x);x.onclick=function(){x.hidden=true}}x.textContent=t;x.hidden=false;clearTimeout(hToast.t);hToast.t=setTimeout(function(){x.hidden=true},Math.max(6000,t.length*90))}
function zwSegs(p,d){try{var x=zwoBuild(p,d).xml,s=[],re=/<(Warmup|Cooldown|SteadyState|IntervalsT|FreeRide|Ramp)\b([^>]*)\/?>/g,m;function at(a,k){var r=new RegExp(k+'="([0-9.]+)"').exec(a);return r?Number(r[1]):null}
while((m=re.exec(x))){var a=m[2];if(m[1]==='IntervalsT'){var n=at(a,'Repeat')||1;for(var i=0;i<n;i++){s.push([at(a,'OnDuration'),at(a,'OnPower')]);s.push([at(a,'OffDuration'),at(a,'OffPower')])}}else if(m[1]==='SteadyState')s.push([at(a,'Duration'),at(a,'Power')]);else if(m[1]==='FreeRide')s.push([at(a,'Duration'),.55]);else s.push([at(a,'Duration'),((at(a,'PowerLow')||.5)+(at(a,'PowerHigh')||.6))/2])}
return s.filter(function(q){return q[0]>0&&q[1]!=null})}catch(e){return[]}}
function profHtml(p,d){var s=zwSegs(p,d);if(!s.length)return'';var mx=Math.max(1.2,Math.max.apply(0,s.map(function(q){return q[1]})));
return'<div class="hprof" aria-hidden="true">'+s.map(function(q){var z=q[1]>=1.06?'z5':q[1]>=.91?'z4':q[1]>=.76?'z3':q[1]>=.56?'z2':'z1';return'<i class="'+z+'" style="flex:'+q[0]+';height:'+Math.max(12,Math.round(q[1]/mx*100))+'%"></i>'}).join('')+'</div>'}
function fuelHtml(p,d){var mi=minsOf(p),zw=isZw(p[2]),hard=intense(p[2]),L=[];
if(mi<60)L.push('🥤 Wasser reicht, '+(zw?'1 Flasche':'eine Flasche'));
else if(mi<90)L.push('🥤 '+(zw?'1–2 Flaschen':'1 Flasche')+' mit 30–40 g Kohlenhydraten pro Stunde');
else if(mi<150)L.push('🥤 '+Math.ceil(mi/60*(zw?.9:.6))+' Flaschen, 60 g Kohlenhydrate pro Stunde (Riegel, Gel oder Getränk)');
else L.push('🍌 '+Math.round(mi/60*70)+' g Kohlenhydrate insgesamt, etwa 70 g pro Stunde, alle 20 min etwas');
if(mi>=90||zw)L.push('🧂 '+(mi>=150?'1 Salztablette pro Stunde':'Salz ins Getränk, rund 500 mg Natrium pro Liter')+' gegen Krämpfe');
if(zw)L.push('🌀 Ventilator an, Handtuch bereit, eher mehr trinken');
if(hard||mi>=120)L.push('🍝 Letzte größere Mahlzeit 2–3 h vorher');
L.push('🥛 Danach 20–30 g Eiweiß und Kohlenhydrate');
return'<ul class="hl">'+L.map(function(x){return'<li>'+E(x)+'</li>'}).join('')+'</ul>'}
function fuelAuto(d){var k=phaseOf(d).k;return['auf','mt','ren','au2','spe','tap','ra2'].indexOf(k)>=0}
function clothes(t,rain,wind){var c=t<=0?'Winterjacke, Winterhose, Überschuhe, dicke Handschuhe, Mütze':t<=5?'Thermojacke, Winterhose, Überschuhe, dicke Handschuhe':t<=10?'Langarmtrikot mit Windweste oder Windjacke, lange Hose oder Knielinge, leichte Handschuhe':t<=15?'Langarm oder Armlinge, Knielinge, Weste dabei':t<=20?'Kurz mit Armlingen oder Weste':'Kurz, Sonnencreme, genug trinken';return c+(rain>=40?'. Regenjacke einpacken':'')+(wind>=25?'. Starker Wind, Windjacke':'')}
function compass(g){return['Nord','Nordost','Ost','Südost','Süd','Südwest','West','Nordwest'][Math.round(((g||0)%360)/45)%8]}
function wxBox(d,p){var id='hw-'+d;setTimeout(function(){wxFill(d,p,id)},0);var f=wxDay(d),dy=f&&f.day||{};return'<div class="card hc" id="'+id+'"><div class="hcl">Wetter und Kleidung · '+stT(d)+'</div>'+(f?'<p>'+(dy.iconPhrase?E(dy.iconPhrase)+', ':'')+(dy.temperature!=null?Math.round(dy.temperature)+'°':'')+(dy.rainProbabilityValue?', Regen '+dy.rainProbabilityValue+' %':'')+'</p>':'<p class="mu">Vorhersage wird geladen …</p>')+'</div>'}
async function wxFill(d,p,id){if(!window.WU_HOURLY)return;var h=HRLY[d];try{if(!h)h=HRLY[d]=await window.WU_HOURLY(d)}catch(e){return}var el=$(id);if(!el||!h||!h.t)return;var s0=Number(stT(d).slice(0,2)),mi=minsOf(p),hrs=[],i;for(i=0;i<h.t.length;i++){var hh=Number(h.t[i].slice(11,13));if(hh>=s0&&hh<=s0+Math.ceil(mi/60))hrs.push(i)}if(!hrs.length)return;
var t0=h.at[hrs[0]],rmax=Math.max.apply(0,hrs.map(function(i){return h.pp[i]||0})),wmax=Math.max.apply(0,hrs.map(function(i){return h.ws[i]||0})),wd=h.wd[hrs[0]],end=s0*60+Number(stT(d).slice(3,5))+mi,ss=h.ss?Number(h.ss.slice(11,13))*60+Number(h.ss.slice(14,16)):null,lt=ss!=null&&end>ss-20;
el.innerHTML='<div class="hcl">Wetter und Kleidung · '+stT(d)+'</div><div class="hhr">'+hrs.slice(0,6).map(function(i){return'<div><small>'+h.t[i].slice(11,16)+'</small><b>'+Math.round(h.tt[i])+'°</b><small>'+(h.pp[i]||0)+' %</small></div>'}).join('')+'</div><ul class="hl"><li>🧥 '+E(clothes(t0,rmax,wmax))+'</li><li>💨 Wind '+Math.round(wmax)+' km/h aus '+compass(wd)+'</li>'+(lt?'<li>💡 Sonnenuntergang '+h.ss.slice(11,16)+': Licht vorne und hinten</li>':'')+(rmax>=60?'<li>🌧 Regen '+rmax+' %: Plan B Zwift</li>':'')+'</ul>'}
function actRow(a){var r=LOG[a.id];return'<div class="hact" data-k="a:'+a.id+'" role="button" tabindex="0">'+H.icn(a.sp)+'<div><b>'+E(a.name)+'</b><small>'+H.fmt(Math.round(a.sec/60))+' · '+(a.est?'ca. ':'')+Math.round(a.tss)+' TSS'+(a.ah?' · Ø '+a.ah+' bpm':'')+(r&&r.rpe?' · RPE '+r.rpe:'')+'</small></div>'+(r?'<span class="ok">✓</span>':'<span class="pill pl">bewerten</span>')+'</div>'}
function ring(sc,lv){var c=lv===2?'var(--bad)':lv===1?'var(--warn)':'var(--ok)',L=301.6;return'<svg class="ring" viewBox="0 0 112 112" aria-hidden="true"><circle cx="56" cy="56" r="48" class="rbg"/><circle cx="56" cy="56" r="48" stroke="'+c+'" stroke-dasharray="'+L+'" stroke-dashoffset="'+(L*(1-sc/100)).toFixed(1)+'" class="rfg"/><text x="56" y="64" text-anchor="middle">'+sc+'</text></svg>'}
function rScore(r){var sc=0,mx=0;r.f.forEach(function(x){sc+=x.l;mx=Math.max(mx,x.l)});return Math.max(10,Math.min(100,Math.round(100-sc*13-(mx===2?8:0))))}
function dayTitle(d){var t=tod();return d===t?'Heute':d===addD(t,-1)?'Gestern':d===addD(t,1)?'Morgen':wdLong(d)}

/* ---------- Reiter Heute ---------- */
function rH(){var c=$('hd-b');if(!c)return;var t=tod(),d=addD(t,DOFF),p=PM[d],X=window.ACT||[],acts=X.filter(function(a){return a.day===d}),isT=d===t,fut=d>t,h='';
h+='<div class="hnav"><button type="button" class="wnav" data-do="-1" aria-label="Vorheriger Tag">‹</button><div class="hti"><b>'+dayTitle(d)+'</b><span>'+wdOf(d)+', '+Number(d.slice(8,10))+'. '+['Jän.','Feb.','März','Apr.','Mai','Juni','Juli','Aug.','Sep.','Okt.','Nov.','Dez.'][Number(d.slice(5,7))-1]+'</span></div><button type="button" class="wnav" data-do="1" aria-label="Nächster Tag"'+(DOFF>=13?' disabled':'')+'>›</button></div>';
if(!isT)h+='<p class="wback"><span class="lnk" data-do="0" role="button" tabindex="0">‹ Zurück zu heute</span></p>';
/* Bereitschaft */
if(isT&&S){var r=rdy();if(r){var sc=rScore(r),f=r.f.filter(function(x){return x.l}).concat(r.f.filter(function(x){return!x.l}));
h+='<div class="card hero2"><div class="hrow">'+ring(sc,r.lv)+'<div><div class="hcl '+['ok','wa','ba'][r.lv]+'">'+RL3[r.lv]+'</div><p class="hrec">'+E(r.rec)+'</p><span class="lnk" data-hx="why" role="button" tabindex="0">'+(HX.why?'Weniger ‹':'Warum? ›')+'</span></div></div>'+(HX.why?'<div class="chips">'+f.map(function(x){return'<span class="chip2 l'+x.l+'">'+E(x.t)+'</span>'}).join('')+'</div>':'')+(moodDue()?'<button type="button" class="pbtn sm mdb" data-k="mood">Morgengefühl eintragen</button>':'')+'</div>'}}
if(!isT&&!fut){var m=MOOD[d];if(m)h+='<p class="mu hsub">Morgengefühl '+m.g+' von 5'+(m.s?', Schlaf '+m.s:'')+(m.b?', Beine '+m.b:'')+'</p>'}
/* Checkliste */
if(isT){var L=[];L.push([!!MOOD[d],'Morgengefühl',MOOD[d]?'eingetragen':'offen','mood']);
if(p)L.push([acts.length>0,p[2],acts.length?'erledigt':stT(d),'p:'+lab(d)]);
if(p&&/Kraft/i.test(p[2]))L.push([!!(KR[d]&&KR[d].fin),'Kraft',KR[d]&&KR[d].fin?'erledigt':'nach der Einheit','kr:'+d]);
acts.forEach(function(a){L.push([!!LOG[a.id],'Bewerten: '+a.name,LOG[a.id]?'erledigt':'offen','a:'+a.id])});
if(new Date().getDay()===5)L.push([!!WT[d],'Wiegen',WT[d]?WT[d]+' kg':'offen','wt']);
if(L.length>1)h+='<div class="card hc"><div class="hcl">Dein Tag</div>'+L.map(function(x){return'<div class="ck" data-k="'+x[3]+'" role="button" tabindex="0"><i class="'+(x[0]?'d':'')+'">'+(x[0]?'✓':'')+'</i><span>'+E(x[1])+'</span><small>'+E(x[2])+'</small></div>'}).join('')+'</div>'}
/* Einheit */
if(acts.length)h+='<div class="card hc"><div class="hcl">'+(isT?'Erledigt':'Gefahren')+'</div>'+acts.map(actRow).join('')+(p?'<p class="mu hsm">Plan: '+E(p[2])+'</p>':'')+'</div>';
if(p&&!acts.length){var zw=isZw(p[2]),sent=window.WU_IVSTAT?window.WU_IVSTAT(d):null,fo=HX.fuel[d]!=null?HX.fuel[d]:fuelAuto(d);
h+='<div class="card hc hses" data-k="p:'+lab(d)+'" role="button" tabindex="0"><div class="hcl">'+(d<t?'Geplant, nicht gemacht':stT(d)+' · '+(zw?'Zwift':outd(p[2])?'draußen':'Training')+' · ca. '+minsOf(p)+' min')+'</div><div class="htl">'+E(p[2])+'</div>'+(zw?profHtml(p,d):'')+(p[3]?'<p class="hsm">'+E(p[3])+'</p>':'')
+'<div class="hst">'+(zw&&sent&&sent.ok?'<span class="pill ok">✓ in Zwift'+(sent.adj&&d===t?' · '+E(sent.adj):'')+'</span>':'')+'<button type="button" class="fbtn'+(fo?' on':'')+'" data-hx="fuel|'+d+'" aria-label="Verpflegung" title="Verpflegung">🍌</button></div>'
+(fo?fuelHtml(p,d):'')+(d>=t?ioHtml(d,p):'')+'</div>';
if(/Kraft/i.test(p[2])&&typeof krBtn==='function'){var KL=krList(d)||[];h+='<div class="card hc"><div class="hcl">Kraft · gegen Krämpfe</div><ul class="hl">'+KL.slice(0,6).map(function(x){return'<li>'+E(x[0])+' <span class="mu">'+E(x[1]||'')+'</span></li>'}).join('')+'</ul>'+krBtn(d)+'</div>'}
if(outd(p[2])&&d>=t&&d<=addD(t,6))h+=wxBox(d,p)}
else if(p&&acts.length&&/Kraft/i.test(p[2])&&typeof krBtn==='function'&&!(KR[d]&&KR[d].fin)&&d>=addD(t,-1)){var KL2=krList(d)||[];h+='<div class="card hc hnow"><div class="hcl">Jetzt · Kraft</div><ul class="hl">'+KL2.slice(0,6).map(function(x){return'<li>'+E(x[0])+' <span class="mu">'+E(x[1]||'')+'</span></li>'}).join('')+'</ul>'+krBtn(d)+'</div>'}
/* Ruhetag */
if(!p&&!acts.length&&d>=t){var nx=PM[addD(d,1)],r2=S&&isT?rdy():null;h+='<div class="card hc"><div class="hcl ok">Ruhetag</div><p>'+(nx?'Erholen für '+E(nx[2])+' '+(addD(d,1)===addD(t,1)?'morgen':'am '+wdLong(addD(d,1)))+'.':'Erholung gehört zum Training.')+(r2&&S?' Form '+sg(S.fm[S.fm.length-1])+'.':'')+'</p><div class="hcl" style="margin-top:10px">10 min Mobilität</div><ul class="hl">'+MOB.slice(0,4).map(function(x){return'<li>'+E(x[0])+' <span class="mu">'+x[1]+'</span></li>'}).join('')+'</ul></div>'}
/* Schlaf am Abend */
if(isT&&new Date().getHours()>=17){var tm=PM[addD(t,1)];if(tm&&(intense(tm[2])||minsOf(tm)>=90)){var sl=[],i;for(i=1;i<=7;i++){var q=(window.REC||{})[addD(t,-i)];if(q&&q.sl)sl.push(q.sl)}var av=sl.length?sl.reduce(function(a,b){return a+b},0)/sl.length:null;h+='<div class="card hc"><div class="hrow2"><span class="hico">🌙</span><div><b>Heute vor 23:00 ins Bett</b><p class="hsm">Morgen '+E(tm[2])+'.'+(av?' Letzte 7 Nächte Ø '+Math.floor(av/60)+':'+String(Math.round(av%60)).padStart(2,'0')+' h Schlaf.':'')+'</p></div></div></div>'}}
/* Wiegen am Freitag */
if(isT&&new Date().getDay()===5){var b=bodyAt(t),b7=bodyAt(addD(t,-7));h+='<div class="card hc" data-k="wt" role="button" tabindex="0"><div class="hcl">Wiegen · Freitag</div>'+(b&&b.d===t?'<div class="hbig">'+f1(b.kg)+' kg'+(b7&&b7.d!==b.d?' <small class="'+(b.kg<=b7.kg?'ok':'ba')+'">'+(b.kg-b7.kg>0?'+':'')+f1(b.kg-b7.kg)+' zur Vorwoche</small>':'')+'</div>'+(b.bf!=null?'<p class="hsm">Körperfett '+f1(b.bf)+' %</p>':''):'<p>Noch kein Wert von heute. Kommt automatisch von der Waage oder hier eintragen.</p>')+'</div>'}
/* Skitour fürs Wochenende */
var gd=new Date(d+'T12:00:00').getDay();if(isT&&(gd>=4||gd===0)&&skiOn()&&SKI&&SKI.vorschlaege&&SKI.vorschlaege.length&&SKI.wochenende>=addD(t,-1)){var v=SKI.vorschlaege[0];h+='<div class="card hc hski" data-k="ski" role="button" tabindex="0"><div class="hcl">Wochenende · Skitour</div><div class="htl">'+E(v.tour)+'</div><p class="hsm">'+skiDay(v.day)+' · '+v.hm+' Hm · Lawinengefahr '+E(v.stufe_text||v.stufe)+' · '+(v.schnee_cm!=null?v.schnee_cm+' cm Schnee':'')+'</p>'+(v.grund?'<p class="hsm">'+E(v.grund)+'</p>':'')+'</div>'}
/* Gestern und Morgen */
if(isT){var yd=addD(t,-1),ya=X.filter(function(a){return a.day===yd}),yp=PM[yd];h+='<div class="card hc hmini" data-do="-1" role="button" tabindex="0"><span class="mu">Gestern</span><div>'+(ya.length?ya.map(function(a){return'<b>'+E(a.name)+'</b><small>'+H.fmt(Math.round(a.sec/60))+' · '+Math.round(a.tss)+' TSS'+(a.ah?' · Ø '+a.ah+' bpm':'')+(LOG[a.id]?' · bewertet':' · noch nicht bewertet')+'</small>'}).join(''):yp?'<b>'+E(yp[2])+'</b><small>nicht gemacht</small>':'<b>Ruhetag</b>')+'</div></div>'}
if(d>=t){var td=addD(d,1),tp=PM[td];h+='<div class="card hc hmini" data-do="'+(DOFF+1)+'" data-dabs="1" role="button" tabindex="0"><span class="mu">'+(isT?'Morgen':wdOf(td))+'</span><div>'+(tp?'<b>'+E(tp[2])+'</b><small>'+(isZw(tp[2])?'Zwift':outd(tp[2])?'draußen':'')+' · '+stT(td)+(outd(tp[2])&&wxDay(td)?' · '+Math.round((wxDay(td).day||{}).temperature)+'°'+((wxDay(td).day||{}).rainProbabilityValue?', Regen '+(wxDay(td).day||{}).rainProbabilityValue+' %':''):'')+'</small>':'<b>Ruhetag</b>')+'</div></div>'}
/* Woche und Fokus */
if(isT){var wd=wkOf(0),pt=0,at=0;wd.forEach(function(x){if(PM[x])pt+=PM[x][1];X.forEach(function(a){if(a.day===x)at+=a.tss})});var ph=phaseOf(t),dm=Math.round((new Date(CF.race+'T12:00:00')-new Date(t+'T12:00:00'))/864e5);
h+='<div class="card hc" data-go="plan" role="button" tabindex="0"><div class="hrow3"><span class="hcl">Woche</span><small>'+Math.round(at)+' von '+Math.round(pt)+' TSS</small></div><div class="bar wb"><i style="width:'+Math.min(100,Math.round(at/Math.max(pt,1)*100))+'%"></i></div><p class="hsm"><b>'+E(ph.n)+':</b> '+E(ph.d)+'</p><p class="hsm mu">Noch '+dm+' Tage bis Mondsee'+(t<'2027-01-04'?' · FTP-Test in '+Math.round((new Date('2027-01-04T12:00:00')-new Date(t+'T12:00:00'))/864e5/7)+' Wochen':'')+'</p></div>'}
c.innerHTML=h}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-do],[data-hx],[data-go]');if(!b||b.disabled)return;e.stopPropagation();e.preventDefault();
if(b.hasAttribute('data-hx')){var q=b.getAttribute('data-hx').split('|');if(q[0]==='why')HX.why=!HX.why;else{var d=q[1];HX.fuel[d]=!(HX.fuel[d]!=null?HX.fuel[d]:fuelAuto(d))}rH();return}
if(b.hasAttribute('data-go')){go(b.getAttribute('data-go'));return}
var v=Number(b.getAttribute('data-do'));DOFF=b.hasAttribute('data-dabs')||v===0?v:Math.max(-60,Math.min(13,DOFF+v));rH();window.scrollTo(0,0)},true);
function go(t){try{history.replaceState(null,'','#'+t)}catch(x){location.hash=t}H.show();window.scrollTo(0,0);try{tabRefresh(t)}catch(x){}}
window.WU_GO=go;

/* ---------- Reiter Weg ---------- */
function rWeg(){var c=$('weg-b');if(!c||!S)return;var t=tod(),P=season(),ph=phaseOf(t),n=S.ct.length,ctl=S.ct[n-1],g=Number(CF.goalMin),now=ozPred(FTP,W,Number(CF.raceStops)),need=ozNeed(Number(CF.kgGoal),Number(CF.raceStops)),h='';
h+='<div class="card hc"><div class="hcl">Ötztaler-Prognose</div><div class="hbig">'+hmS(now.t)+' h <small class="'+(now.t<=g?'ok':'wa')+'">Ziel unter '+hmS(g)+' h</small></div><p class="hsm">Mit deiner FTP '+FTP+' W und '+f1(W)+' kg, '+CF.raceStops+' min Pause. Für das Ziel bei '+CF.kgGoal+' kg nötig: '+need+' W ('+f1(need/Number(CF.kgGoal))+' W/kg).</p></div>';
var a0=P[0].a,b0=P[P.length-1].b,span=dd2(a0,b0)||1,pos=function(d){return Math.max(0,Math.min(100,dd2(a0,d)/span*100))};
h+='<div class="card hc"><div class="hcl">Saison</div><div class="sbar">'+P.map(function(p){return'<i title="'+E(p.n)+'" style="flex:'+Math.max(1,dd2(p.a,p.b)+1)+';background:'+(PHC[p.k]||'#888')+'"></i>'}).join('')+'<span class="snow" style="left:'+pos(t)+'%"></span><span class="sfl" style="left:'+pos(CF.race)+'%">🏁</span><span class="sfl" style="left:100%">🏔</span></div><div class="sdt"><span>Heute</span><span>🏁 Mondsee '+lab(CF.race)+' · 🏔 Ötztaler '+lab(CF.race2)+'</span></div></div>';
var bw=bodyAt(t),kg=bw?bw.kg:W,fg=Number(CF.ftpGoal),kgG=Number(CF.kgGoal),c1=Number(CF.race2Ctl),tg=typeof tgtAt==='function'?tgtAt(t):null;
var gl=function(n2,v,goal,pc,cl,sub){return'<div class="goal2"><div class="hrow3"><b>'+n2+'</b><span><b>'+v+'</b> <span class="mu">→ '+goal+'</span></span></div><div class="bar"><i style="width:'+Math.max(2,Math.min(100,pc))+'%;background:'+cl+'"></i></div>'+(sub?'<small class="mu">'+sub+'</small>':'')+'</div>'};
h+='<div class="card hc"><div class="hcl">Ziele</div>'+gl('FTP',FTP+' W',fg+' W',(FTP-230)/(fg-230)*100,'var(--ac)','')+gl('Gewicht',f1(kg)+' kg',kgG+' kg',(OZ26.kg+2-kg)/(OZ26.kg+2-kgG)*100,'var(--ok)','')+gl('Fitness',Math.round(ctl),c1+' am Ötztaler',ctl/c1*100,'var(--warn)',tg!=null?'Soll heute ca. '+Math.round(tg):'')+'</div>';
h+='<div class="card hc hphase" style="border-color:'+(PHC[ph.k]||'var(--ln)')+'"><div class="hrow3"><span class="hcl">Jetzt · '+E(ph.n)+'</span><small class="mu">bis '+dd(ph.b)+'</small></div><p>'+E(ph.d)+'</p>'+(KRT[ph.k]?'<p class="hsm">⚡ <b>Krämpfe:</b> '+E(KRT[ph.k])+'</p>':'')+'</div>';
h+='<div class="card hc hmore"><div class="mi" data-go="analyse" role="button" tabindex="0"><b>📊 Analysen</b><small>Form, Leistung, Zonen, Umfang, Bestwerte ›</small></div><div class="mi" data-go="einheiten" role="button" tabindex="0"><b>🗂 Alle Einheiten</b><small>Archiv mit Details und Karte ›</small></div><div class="mi" data-go="saison" role="button" tabindex="0"><b>🗓 Saison im Detail</b><small>Phasen, Rennen, Gewicht, Krämpfe, Bericht ›</small></div><div class="mi" data-k="ski" role="button" tabindex="0"><b>⛷ Skitouren</b><small>Vorschlag fürs Wochenende ›</small></div><div class="mi" data-k="zon" role="button" tabindex="0"><b>🎯 Zonen und Schwellenwerte</b><small>FTP '+FTP+' W, Schwellenpuls '+CF.lthr+' ›</small></div></div>';
c.innerHTML=h}

/* ---------- Woche: kompakter, Wetter nur draußen, Schalter ---------- */
var _rpNeu=rp;rp=function(){_rpNeu();var c=$('pl-wk');if(!c)return;
[].forEach.call(c.querySelectorAll('.rdy,.mdb'),function(x){x.remove()});
[].forEach.call(c.querySelectorAll('.zwr'),function(x){x.remove()});
[].forEach.call(c.querySelectorAll('.l.tl>li'),function(li){var k=li.getAttribute('data-k')||'',m=/p:(\d+)\.(\d+)\./.exec(k);if(!m)return;var d=wkOf(WOFF).filter(function(x){return lab(x)===m[1]+'.'+m[2]+'.'})[0];if(!d)return;var p=PM[d],t=tod();
if(li.classList.contains('s-fr')){li.classList.add('fr2');var s=li.querySelector('.hd strong');if(s)s.textContent='frei';var w=li.querySelector('.wxc');if(w)w.remove();var pl=li.querySelector('.pill');if(pl)pl.remove()}
if(p&&!outd(p[2])){var w2=li.querySelector('.wxc');if(w2)w2.remove()}
if(p&&d>=t&&!(window.ACT||[]).some(function(a){return a.day===d})){var bd=li.querySelector('.bd');if(bd&&isBike(p[2]))bd.insertAdjacentHTML('beforeend',ioHtml(d,p,true))}})};

/* ---------- Navigation und Wischen ---------- */
var _rallNeu=rall;rall=function(){_rallNeu();try{rH()}catch(e){logErr('App','Heute',e)}try{rWeg()}catch(e){logErr('App','Weg',e)}};
(function(){var x0=null,y0=0,t0=0;document.addEventListener('touchstart',function(e){if(!$('sh').hidden||e.touches.length!==1){x0=null;return}var el=e.target;if(el.closest&&el.closest('.wm,.wxs,.ioseg,input,textarea,.hprof,svg,.leaflet-container')){x0=null;return}x0=e.touches[0].clientX;y0=e.touches[0].clientY;t0=Date.now()},{passive:true});
document.addEventListener('touchend',function(e){if(x0==null)return;var dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;x0=null;if(Math.abs(dx)<70||Math.abs(dy)>Math.abs(dx)*.6||Date.now()-t0>700)return;step(dx<0?1:-1)},{passive:true});
document.addEventListener('keydown',function(e){if(!$('sh').hidden||/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||''))return;if(e.key==='ArrowLeft')step(-1);if(e.key==='ArrowRight')step(1)});
function step(v){var tb=document.body.getAttribute('data-tab');if(tb==='heute'){DOFF=Math.max(-60,Math.min(13,DOFF+v));rH()}else if(tb==='plan'){WOFF=Math.max(WMIN(),Math.min(8,WOFF+v));rp()}}})();
setTimeout(function(){try{rpm();rH();rWeg()}catch(e){}},0);
setInterval(function(){if(document.visibilityState==='visible'&&document.body.getAttribute('data-tab')==='heute'&&tod()!==rH.d){rH.d=tod();DOFF=0;rH()}},60000);
