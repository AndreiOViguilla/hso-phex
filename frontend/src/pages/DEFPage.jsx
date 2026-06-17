import { useState, useEffect, useCallback, useRef } from "react";
import { useIsMobile } from "../utils/useIsMobile";
import { NavBar, Btn } from "../components/UI";
import { useTheme } from "../ThemeContext";
import { useModal } from "../components/Modal";
import { renderFieldOwnerTooltips } from "../fieldOwnerTooltips";
import LiveFieldOverlay, { useLiveFieldOverlay } from "../useLiveFieldOverlay";

const DEF_STUDENT_FIELDS = new Set(["Name", "ID No"]);
function getDefFieldOwner(fieldName) { return DEF_STUDENT_FIELDS.has(fieldName) ? "Student" : "Nurse"; }

export default function DEFPage({ prefillId, prefillName, onBack, onSuccess }) {
  const isMobile = useIsMobile();
  const { dark, toggle, t } = useTheme();
  const { show } = useModal();
  const canvasRef = useRef(null);
  const pdfDocRef = useRef(null);
  const scaleRef = useRef(1);
  const requestIdRef = useRef(0);
  const annotationLayerRef = useRef(null);
  const tooltipLayerRef = useRef(null);

  const [mobileTab, setMobileTab] = useState("form");
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [pdfReady,setPdfReady]=useState(false),[pdfError,setPdfError]=useState(false);
  const [rendering,setRendering]=useState(false),[downloading,setDownloading]=useState(false);
  const [downloaded,setDownloaded]=useState(false),[zoom,setZoom]=useState(1.0);
  const [pdfVersion,setPdfVersion]=useState(0),[overlayDims,setOverlayDims]=useState({width:0,height:0});
  const {fieldRects,captureFieldRects}=useLiveFieldOverlay();

  const [form,setForm]=useState({name:prefillName||"",idNo:prefillId||""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const draftTimer=useRef(null);
  useEffect(()=>{localStorage.setItem("def_draft",JSON.stringify(form));clearTimeout(draftTimer.current);draftTimer.current=setTimeout(()=>{},1500);},[form]);
  useEffect(()=>{try{const d=localStorage.getItem("def_draft");if(d)setForm(f=>({...f,...JSON.parse(d)}))}catch(_){}},[]);
  useEffect(()=>{fetch("/api/students/me",{credentials:"include"}).then(r=>r.ok?r.json():null).then(user=>{if(!user)return;setForm(f=>({...f,idNo:user.studentId||f.idNo,name:[user.firstName,user.middleInitial,user.lastName].filter(Boolean).join(" ")||f.name}));}).catch(()=>{});},[]);

  useEffect(()=>{
    const load=async()=>{
      if(!document.getElementById("pdfjs-annotation-css")){const l=document.createElement("link");l.id="pdfjs-annotation-css";l.rel="stylesheet";l.href="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.css";document.head.appendChild(l);}
      if(!window.pdfjsLib){await new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);});window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";}
      if(!window.pdfjsViewer){await new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
    };load();
  },[]);

  const loadFilledPdf=useCallback(async()=>{
    if(!window.pdfjsLib)return;const reqId=++requestIdRef.current;setRendering(true);
    try{const resp=await fetch("/api/forms/def/preview",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify(form)});
      if(!resp.ok)throw new Error("not found");const doc=await window.pdfjsLib.getDocument({data:await resp.arrayBuffer()}).promise;
      if(reqId!==requestIdRef.current)return;pdfDocRef.current=doc;setPdfReady(true);setPdfError(false);setPdfVersion(v=>v+1);
    }catch(e){if(reqId===requestIdRef.current)setPdfError(true);}
    if(reqId===requestIdRef.current)setRendering(false);
  },[form]);

  useEffect(()=>{const ti=setTimeout(loadFilledPdf,350);return()=>clearTimeout(ti);},[form,loadFilledPdf]);

  const renderPreview=useCallback(async()=>{
    if(!pdfDocRef.current||!canvasRef.current)return;setRendering(true);
    try{
      const page=await pdfDocRef.current.getPage(1);const canvas=canvasRef.current;
      const dpr=window.devicePixelRatio||1;const panelW=(canvas.parentElement?.parentElement?.clientWidth||700)-24;
      const pdfNatural=page.getViewport({scale:1});const fitWidth=Math.max(panelW,280)*zoom;
      const fitScale=fitWidth/pdfNatural.width;const viewport=page.getViewport({scale:fitScale*Math.max(dpr,2)});
      canvas.width=viewport.width;canvas.height=viewport.height;
      canvas.style.width=`${fitWidth}px`;canvas.style.height=`${pdfNatural.height*fitScale}px`;
      canvas.style.display="block";canvas.style.margin=zoom<=1?"0 auto":"0";
      await page.render({canvasContext:canvas.getContext("2d"),viewport}).promise;
      const fitHeight=pdfNatural.height*fitScale;const cssViewport=page.getViewport({scale:fitScale});
      setOverlayDims({width:fitWidth,height:fitHeight});await captureFieldRects(page,cssViewport,fitScale);
      const annotationDiv=annotationLayerRef.current;
      if(annotationDiv&&window.pdfjsViewer){
        annotationDiv.innerHTML="";annotationDiv.style.width=`${fitWidth}px`;annotationDiv.style.height=`${fitHeight}px`;annotationDiv.style.margin=zoom<=1?"0 auto":"0";
        try{const annotations=await page.getAnnotations({intent:"display"});
          window.pdfjsViewer.AnnotationLayer.render({viewport:cssViewport.clone({dontFlip:true}),div:annotationDiv,annotations,page,renderForms:true,
            linkService:{getDestinationHash:()=>"#",getAnchorUrl:()=>"#",addLinkAttributes:()=>{},executeNamedAction:()=>{},isPageVisible:()=>true,eventBus:new window.pdfjsViewer.EventBus()},
            downloadManager:null,imageResourcesPath:"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/web/images/"});
          annotationDiv.querySelectorAll("input,textarea,select,section").forEach(el=>{el.style.pointerEvents="none";el.style.color="transparent";el.style.caretColor="transparent";});
        }catch(_){}
      }
      const tooltipDiv=tooltipLayerRef.current;
      if(tooltipDiv)await renderFieldOwnerTooltips({page,cssViewport,container:tooltipDiv,fitWidth,fitHeight,getFieldOwner:getDefFieldOwner});
    }catch(e){console.error("Render error:",e);}setRendering(false);
  },[zoom,captureFieldRects]);

  useEffect(()=>{if(!pdfReady)return;renderPreview();},[pdfReady,pdfVersion,zoom,renderPreview]);
  useEffect(()=>{if(!pdfReady)return;const h=()=>renderPreview();window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[pdfReady,renderPreview]);
  useEffect(()=>{if(mobileTab==="preview")setTimeout(renderPreview,50);},[mobileTab]);

  const handleDownload=async()=>{
    const missing=[];if(!form.name)missing.push("Full name");if(!form.idNo)missing.push("ID number");
    if(missing.length>0){show({type:"error",title:"Incomplete form",message:`Please fill in: ${missing.join(", ")}.`});return;}
    setDownloading(true);
    try{const resp=await fetch("/api/forms/def",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify(form)});
      if(!resp.ok)throw new Error((await resp.json().catch(()=>({}))).error||"Failed to generate PDF");
      const url=URL.createObjectURL(await resp.blob());const a=document.createElement("a");a.href=url;a.download=`DEF_${form.idNo||"student"}.pdf`;a.click();URL.revokeObjectURL(url);setDownloaded(true);
    }catch(e){show({type:"error",title:"Download failed",message:e.message});}
    setDownloading(false);
  };

  const inp=(extra)=>({padding:"9px 12px",border:`1px solid ${t.inputBorder}`,borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box",background:t.input,color:t.text,colorScheme:dark?"dark":"light",...extra});
  const lbl={fontSize:12,fontWeight:600,color:t.textSub,display:"block",marginBottom:4};
  const sec={fontSize:11,fontWeight:700,color:t.textSub,textTransform:"uppercase",letterSpacing:"0.08em",borderBottom:`1.5px solid ${t.divider}`,paddingBottom:8,marginBottom:14};
  const c2={display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,marginBottom:12};

  const formPanel=(
    <div style={{overflowY:"auto",padding:"16px 20px",flex:1,background:t.bg}}>
      <div style={{marginBottom:22}}>
        <div style={sec}>Student information</div>
        <div style={c2}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}><label style={lbl}>Full name</label><input style={inp()} placeholder="Juan A. Dela Cruz" value={form.name} onChange={e=>set("name",e.target.value)}/></div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}><label style={lbl}>ID number</label><input style={inp()} placeholder="12512345" value={form.idNo} onChange={e=>set("idNo",e.target.value)}/></div>
        </div>
      </div>
      <div style={{background:t.blueBg,border:`1px solid ${t.blue}44`,borderRadius:12,padding:"14px 16px",marginBottom:22}}>
        <div style={{fontSize:13,fontWeight:700,color:t.blueText,marginBottom:6}}>Dentist-filled section</div>
        <div style={{fontSize:12,color:t.blueText,lineHeight:1.7}}>The rest of the DEF — General Condition checkboxes, tooth chart, and Other Remarks — is completed by your <strong>assigned dentist</strong>. You only need your name and ID number above.</div>
      </div>
      <div style={{background:t.card,border:`1px solid ${t.cardBorder}`,borderRadius:12,padding:"14px 16px",marginBottom:22}}>
        <div style={{fontSize:13,fontWeight:700,color:t.text,marginBottom:8}}>What to bring</div>
        {["This printed DEF form (or show this screen)","Your student ID","Your PHEx appointment confirmation"].map((item,i)=>(
          <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:6}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:t.accent,marginTop:5,flexShrink:0}}/>
            <div style={{fontSize:13,color:t.textSub}}>{item}</div>
          </div>
        ))}
      </div>
      <div style={{background:t.orangeBg,border:`1px solid ${t.orange}44`,borderRadius:10,padding:"12px 14px",marginBottom:18,fontSize:12,color:t.orangeText,lineHeight:1.7}}>
        Dental examination is part of the on-site PHEx. If using an accredited clinic, bring this DEF along with the MEF and request X-ray with dental exam.
      </div>
      <Btn variant="primary" onClick={handleDownload} style={{opacity:downloading?0.7:1}}>
        {downloading?"Generating PDF…":downloaded?"Re-download DEF PDF":"Generate & download DEF PDF →"}
      </Btn>
      <button onClick={()=>{
        const missing=[];if(!form.name)missing.push("Full name");if(!form.idNo)missing.push("ID number");
        if(missing.length>0){show({type:"error",title:"Incomplete form",message:`Please fill in: ${missing.join(", ")}.`});return;}
        if(!downloaded){show({type:"error",title:"Download required",message:"Please generate and download the DEF PDF first."});return;}
        localStorage.removeItem("def_draft");onSuccess();
      }} style={{width:"100%",marginTop:10,padding:"13px",background:t.green,color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Mark DEF as complete
      </button>
      <div style={{height:20}}/>
    </div>
  );

  const previewPanel=(
    <div style={{background:"#374151",display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
      <div style={{background:"#1f2937",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:11,color:rendering?"#9ca3af":pdfError?"#fca5a5":pdfReady?"#6ee7b7":"#9ca3af"}}>
          {rendering?"Updating…":pdfError?"PDF not found":pdfReady?"Hover a field to see who fills it →":"Loading…"}
        </span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setZoom(z=>Math.max(0.5,parseFloat((z-0.25).toFixed(2))))} disabled={zoom<=0.5} style={{background:"none",border:"none",cursor:zoom<=0.5?"not-allowed":"pointer",color:zoom<=0.5?"#4b5563":"#d1d5db",padding:4,display:"flex",alignItems:"center"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <span style={{fontSize:12,fontWeight:700,color:"#d1d5db",minWidth:40,textAlign:"center"}}>{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.min(3.0,parseFloat((z+0.25).toFixed(2))))} disabled={zoom>=3.0} style={{background:"none",border:"none",cursor:zoom>=3.0?"not-allowed":"pointer",color:zoom>=3.0?"#4b5563":"#d1d5db",padding:4,display:"flex",alignItems:"center"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
        </div>
      </div>
      <div style={{flex:1,overflow:"auto",padding:"12px"}}>
        {pdfError?(
          <div style={{color:"#d1d5db",fontSize:13,padding:20,lineHeight:1.8}}><strong>Preview unavailable</strong><br/><br/>Make sure <code style={{background:"#1f2937",padding:"2px 6px",borderRadius:4}}>backend/public/dental-form.pdf</code> exists.</div>
        ):(
          <div style={{position:"relative",display:"inline-block"}}>
            <canvas ref={canvasRef} style={{borderRadius:4,display:"block"}}/>
            <div ref={annotationLayerRef} className="annotationLayer" style={{position:"absolute",top:0,left:0,pointerEvents:"none"}}/>
            <LiveFieldOverlay fieldRects={fieldRects} values={{"Name":form.name,"ID No":form.idNo}} fitWidth={overlayDims.width} fitHeight={overlayDims.height}/>
            <div ref={tooltipLayerRef} style={{position:"absolute",top:0,left:0}}/>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,background:t.bg}}>
      <div style={{background:dark?"#1e293b":"#1e3a8a",color:"#fff",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <button onClick={onBack} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700}}>Dental Examination Form</div>
          {!isNarrow&&<div style={{fontSize:11,opacity:0.7}}>Hover a field in the preview to see who fills it</div>}
        </div>
        {isNarrow&&(
          <div style={{display:"flex",background:"rgba(255,255,255,0.15)",borderRadius:8,padding:2,gap:2}}>
            {["form","preview"].map(tab=>(
              <button key={tab} onClick={()=>{setMobileTab(tab);if(tab==="preview")setTimeout(renderPreview,50);}}
                style={{padding:"4px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",background:mobileTab===tab?"#fff":"transparent",color:mobileTab===tab?"#1e3a8a":"rgba(255,255,255,0.8)"}}>
                {tab==="form"?"Form":"Preview"}
              </button>
            ))}
          </div>
        )}
        <button onClick={toggle} title={dark?"Light mode":"Dark mode"} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:34,height:34,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {dark?<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          :<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
        </button>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"row",minHeight:0,overflow:"hidden"}}>
        <div style={{flex:isNarrow?"1":"0 0 42%",minWidth:isNarrow?0:380,maxWidth:isNarrow?"none":520,borderRight:isNarrow?"none":`1px solid ${t.divider}`,display:isNarrow?(mobileTab==="form"?"flex":"none"):"flex",flexDirection:"column",overflowY:"auto"}}>
          {formPanel}
        </div>
        <div style={{flex:1,display:isNarrow?(mobileTab==="preview"?"flex":"none"):"flex",flexDirection:"column",overflow:"hidden"}}>
          {previewPanel}
        </div>
      </div>
    </div>
  );
}