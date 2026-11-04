/* Meta Pixel 1147746907945876. Marketing pages only, after advertising consent. */
(function(w,d){
 if(w.vimbreMeta)return;
 var key='vimbre:marketing-consent:v1',choice=null,loaded=false,last='';
 var publicPaths=['/','/pricing','/faq','/how-it-works','/integrations','/tour','/for-individuals','/for-founders','/for-companies','/use-cases/handover','/use-cases/decisions','/use-cases/workday-planner','/blog','/contact'];
 function allowed(path){return publicPaths.indexOf(path)!==-1||/^\/blog\/[a-z0-9-]+\/?$/.test(path);}
 function load(){
  if(loaded)return;loaded=true;
  // Standard Meta queue; automatic event collection is disabled below.
  if(!w.fbq){var n=w.fbq=function(){if(n.callMethod)n.callMethod.apply(n,arguments);else n.queue.push(arguments);};if(!w._fbq)w._fbq=n;n.push=n;n.loaded=true;n.version='2.0';n.queue=[];}
  w.fbq('consent','grant');w.fbq('set','autoConfig',false,'1147746907945876');w.fbq('init','1147746907945876');
  var script=d.createElement('script');script.async=true;script.referrerPolicy='origin';script.src='https://connect.facebook.net/en_US/fbevents.js';d.head.appendChild(script);
 }
 function page(path){
  if(choice!=='accepted'||!allowed(path)||!allowed(w.location.pathname)||last===path)return;
  // Never measure account, workspace, OAuth or private record screens.
  if(/[?&#](access_token|refresh_token|code|token|invite|email)=/i.test(w.location.search+w.location.hash))return;
  try{load();w.fbq('track','PageView');last=path;}catch{/* Marketing never blocks the page. */}
 }
 function clear(){try{d.cookie.split(';').forEach(function(part){var name=part.split('=')[0].trim();if(!/^_fb[pc]$/.test(name))return;['',w.location.hostname,'.'+w.location.hostname,'.vimbre.com'].forEach(function(domain){d.cookie=name+'=; Max-Age=0; path=/; SameSite=Lax'+(domain?'; domain='+domain:'');});});}catch {}}
 function choose(value,persist){
  if(value!=='accepted'&&value!=='declined')return;choice=value;
  if(persist)try{w.localStorage.setItem(key,value);}catch{}
  if(value==='accepted'){if(loaded)w.fbq('consent','grant');page(w.location.pathname);}else{last='';if(loaded)w.fbq('consent','revoke');clear();}
  w.dispatchEvent(new Event('vimbre:marketing-consent'));
 }
 w.vimbreMeta={get consent(){return choice;},choose:function(value){choose(value,true);},pageView:page};
 try{var saved=w.localStorage.getItem(key);if(saved)choose(saved,false);}catch{}
 w.addEventListener('storage',function(e){if(e.key===key)choose(e.newValue||'declined',false);});
})(window,document);
