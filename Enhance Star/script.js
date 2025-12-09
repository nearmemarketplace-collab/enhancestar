(function(){
  // Constants - Cloudinary placeholder (user can replace)
  const CLOUD_NAME = "dxbahdjk1"; // replace with your cloud name
  const UPLOAD_PRESET = "nearmemarketplace"; // replace with your preset if needed

  // State
  const state = {
    file: null,
    publicId: null,
    originalUrl: null,
    enhancedUrl: null,
    bgRemovedUrl: null,
    zoom: { original: 1, enhanced: 1 },
    pan: { original: {x:0,y:0}, enhanced: {x:0,y:0} },
    settings: { noise:50, sharpen:60, width:2400, improve:true, upscale:true }
  };

  // Elements
  const introLoader = document.getElementById("introLoader");
  const loaderBar = document.getElementById("loaderBar");
  const loaderEta = document.getElementById("loaderEta");
  const yearSpan = document.getElementById("year");
  yearSpan.textContent = new Date().getFullYear();

  const fileInput = document.getElementById("file");
  const clearBtn = document.getElementById("clearBtn");
  const enhanceBtn = document.getElementById("enhanceBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const progressBar = document.getElementById("progressBar");

  const originalImg = document.getElementById("originalImg");
  const enhancedImg = document.getElementById("enhancedImg");
  const originalInfo = document.getElementById("originalInfo");
  const enhancedInfo = document.getElementById("enhancedInfo");

  const bgRemoveBtn = document.getElementById("bgRemoveBtn");
  const bgProgressBar = document.getElementById("bgProgressBar");
  const downloadBgBtn = document.getElementById("downloadBgBtn");

  // Settings elements
  const noiseRange = document.getElementById("noiseRange");
  const noiseNumber = document.getElementById("noiseNumber");
  const sharpenRange = document.getElementById("sharpenRange");
  const sharpenNumber = document.getElementById("sharpenNumber");
  const widthRange = document.getElementById("widthRange");
  const widthNumber = document.getElementById("widthNumber");
  const improveSwitch = document.getElementById("improveSwitch");
  const upscaleSwitch = document.getElementById("upscaleSwitch");

  const toast = document.getElementById("toast");
  const autoDownloadSwitch = document.getElementById("autoDownload");

  // UTILITIES
  function showToast(msg, ok=false){
    toast.textContent = msg;
    toast.style.borderColor = ok ? "rgba(124,240,201,0.50)" : "rgba(255,255,255,0.06)";
    toast.style.display = "block";
    setTimeout(()=> toast.style.display = "none", 2600);
  }
  function setProgress(pct){ progressBar.style.width = (pct||0) + "%"; }
  function setBgProgress(pct){ bgProgressBar.style.width = (pct||0) + "%"; }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  function triggerDownload(url, name="imagen.jpg"){
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  function suggestFileName(originalName, suffix="enhanced"){
    const safe = (originalName || "imagen").replace(/\.[^/.]+$/, "");
    return `${safe}.${suffix}.jpg`;
  }

  // CLOUDINARY HELPERS (unsigned upload)
  function baseUploadUrl(){ return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`; }

  async function unsignedUpload(file){
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    const res = await fetch(url, { method: "POST", body: formData });
    if(!res.ok){
      const t = await res.text();
      throw new Error("Error subiendo imagen: " + t);
    }
    return res.json();
  }

  function buildTransformUrl(publicId, effects){
    const effStr = effects && effects.length ? effects.join(",") + "/" : "";
    return `${baseUploadUrl()}/${effStr}${publicId}`;
  }

  function thumbUrl(publicId){
    const effects = ["f_auto","q_auto","c_fit","w_1200","dpr_2"];
    return buildTransformUrl(publicId, effects);
  }

  function enhanceUrl(publicId, opts={}){
    const { width = state.settings.width, dpr = 2, noise = state.settings.noise, sharpen = state.settings.sharpen, improve = state.settings.improve, upscale = state.settings.upscale, crop = "limit" } = opts;
    const effects = ["f_auto","q_auto:best",`c_${crop}`,`w_${width}`,`dpr_${dpr}`,`e_noise:${noise}`,`e_sharpen:${sharpen}`];
    if(improve) effects.push("e_improve");
    if(upscale) effects.push("e_upscale");
    return buildTransformUrl(publicId, effects);
  }

  function bgRemovalUrl(publicId, opts={}){
    const { width=2000, dpr=2, crop="limit", alpha=true, refine=true } = opts;
    const effects = [ alpha ? "f_png" : "f_auto", "q_auto:best", `c_${crop}`, `w_${width}`, `dpr_${dpr}`, "e_background_removal" ];
    let url = buildTransformUrl(publicId, effects);
    if(refine) url = url.replace("/image/upload/", `/image/upload/e_sharpen:30/`);
    return url;
  }

  function warmImage(url){
    return new Promise((resolve,reject)=>{
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = ()=> resolve();
      img.onerror = (e)=> reject(e);
      img.src = url + (url.includes("?") ? "&" : "?") + "cachebust=" + Date.now();
    });
  }

  // ACTION LOADER (visual simple)
  function showActionLoader(title="Procesando…", subtitle="Aplicando magia IA"){
    showToast(title + " — " + subtitle);
  }

  // HANDLE FILE UPLOAD
  fileInput.addEventListener("change", async (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    try{
      showActionLoader("Subiendo imagen…", "Preparando archivo");
      setProgress(10); setBgProgress(8);
      const res = await unsignedUpload(f);
      state.file = f; state.publicId = res.public_id; state.originalUrl = res.secure_url;
      originalImg.src = thumbUrl(res.public_id);
      originalInfo.textContent = `${f.name} • ${(f.size/1024/1024).toFixed(2)} MB`;
      setProgress(45); setBgProgress(35);
      clearBtn.disabled = false; enhanceBtn.disabled = false; bgRemoveBtn.disabled = false;
      showToast("Imagen subida correctamente", true);
      await warmImage(originalImg.src);
    }catch(err){
      console.error(err);
      showToast("Falló la subida. Revisa Cloud Name y Upload Preset.");
    }finally{
      setTimeout(()=>{ setProgress(0); setBgProgress(0); }, 700);
    }
  });

  clearBtn.addEventListener("click", ()=>{
    resetView(); fileInput.value = "";
    showToast("Limpieza completa", true);
  });

  function resetView(){
    originalImg.src = ""; enhancedImg.src = ""; state.file = null; state.publicId = null; state.originalUrl = null; state.enhancedUrl = null; state.bgRemovedUrl = null;
    originalInfo.textContent = "Sin imagen"; enhancedInfo.textContent = "Pendiente";
    setProgress(0); setBgProgress(0);
    enhanceBtn.disabled = true; clearBtn.disabled = true; downloadBtn.disabled = true; bgRemoveBtn.disabled = true; downloadBgBtn.disabled = true;
    state.zoom.original = 1; state.zoom.enhanced = 1;
    state.pan.original = {x:0,y:0}; state.pan.enhanced = {x:0,y:0};
  }

  // ENHANCE BUTTON
  enhanceBtn.addEventListener("click", async ()=>{
    if(!state.publicId) return;
    try{
      enhanceBtn.disabled = true;
      setProgress(10); showActionLoader("Mejorando calidad","Optimización y upscale");
      const previewUrl = enhanceUrl(state.publicId, { width: Math.max(1400, Math.round(state.settings.width * 0.66)), dpr:2, noise: state.settings.noise, sharpen: state.settings.sharpen });
      await warmImage(previewUrl); setProgress(45);
      const finalUrl = enhanceUrl(state.publicId, { width: state.settings.width, dpr:2, noise: state.settings.noise, sharpen: state.settings.sharpen });
      await warmImage(finalUrl); setProgress(88);
      state.enhancedUrl = finalUrl; enhancedImg.src = finalUrl;
      enhancedInfo.textContent = `Mejora: ruido ${state.settings.noise} • nitidez ${state.settings.sharpen} • w ${state.settings.width}`;
      showToast("Calidad mejorada.", true);
      setProgress(100);
      setTimeout(()=>{ downloadBtn.disabled = false; if(autoDownloadSwitch.checked) triggerDownload(finalUrl, suggestFileName(state.file?.name,"enhanced")); }, 200);
    }catch(err){
      console.error(err);
      showToast("Falló la mejora. Revisa permisos de transformaciones.");
      setProgress(0);
    }finally{
      enhanceBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener("click", ()=>{
    if(!state.enhancedUrl) return;
    triggerDownload(state.enhancedUrl, suggestFileName(state.file?.name,"enhanced"));
  });

  // BG REMOVAL
  bgRemoveBtn.addEventListener("click", async ()=>{
    if(!state.publicId) return;
    try{
      bgRemoveBtn.disabled = true;
      setBgProgress(12); showActionLoader("Eliminando fondo","Generando máscara");
      const urlTry = bgRemovalUrl(state.publicId, { width:2000, dpr:2, alpha:true, refine:true });
      await warmImage(urlTry); setBgProgress(72);
      state.bgRemovedUrl = urlTry; originalImg.src = urlTry; originalInfo.textContent = "Fondo eliminado (PNG)";
      setBgProgress(100); downloadBgBtn.disabled = false; showToast("Fondo eliminado.", true);
      if(autoDownloadSwitch.checked) triggerDownload(urlTry, suggestFileName(state.file?.name,"no-bg"));
    }catch(err){
      console.error(err);
      showToast("No se pudo eliminar el fondo. El add-on puede no estar activo.");
      setBgProgress(0);
    }finally{
      bgRemoveBtn.disabled = false;
    }
  });

  downloadBgBtn.addEventListener("click", ()=>{
    if(!state.bgRemovedUrl) return;
    triggerDownload(state.bgRemovedUrl, suggestFileName(state.file?.name,"no-bg"));
  });

  // Make images interactive (zoom/pan)
  function makeInteractive(imgEl, key){
    let dragging = false, last = {x:0,y:0};
    imgEl.addEventListener("wheel", (e)=>{
      e.preventDefault();
      const delta = Math.sign(e.deltaY) * -0.08;
      const next = clamp(state.zoom[key] + delta, 1, 8);
      state.zoom[key] = next;
      applyTransform(imgEl, state.zoom[key], state.pan[key]);
    }, { passive:false });

    imgEl.addEventListener("mousedown", (e)=>{
      dragging = true; last = {x:e.clientX, y:e.clientY}; imgEl.style.cursor = "grabbing";
    });
    window.addEventListener("mouseup", ()=>{ dragging=false; imgEl.style.cursor = "default"; });
    imgEl.addEventListener("mousemove", (e)=>{
      if(!dragging) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      last = {x:e.clientX, y:e.clientY};
      state.pan[key].x += dx; state.pan[key].y += dy;
      applyTransform(imgEl, state.zoom[key], state.pan[key]);
    });
  }

  function applyTransform(imgEl, zoom, pan){
    imgEl.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  }

  makeInteractive(originalImg, "original");
  makeInteractive(enhancedImg, "enhanced");

  // Zoom buttons
  document.getElementById("origZoomIn").addEventListener("click", ()=>{ state.zoom.original = clamp(state.zoom.original+0.25,1,8); applyTransform(originalImg,state.zoom.original,state.pan.original); });
  document.getElementById("origZoomOut").addEventListener("click", ()=>{ state.zoom.original = clamp(state.zoom.original-0.25,1,8); applyTransform(originalImg,state.zoom.original,state.pan.original); });
  document.getElementById("origReset").addEventListener("click", ()=>{ state.zoom.original=1; state.pan.original={x:0,y:0}; applyTransform(originalImg,1,state.pan.original); });

  document.getElementById("enhZoomIn").addEventListener("click", ()=>{ state.zoom.enhanced = clamp(state.zoom.enhanced+0.25,1,8); applyTransform(enhancedImg,state.zoom.enhanced,state.pan.enhanced); });
  document.getElementById("enhZoomOut").addEventListener("click", ()=>{ state.zoom.enhanced = clamp(state.zoom.enhanced-0.25,1,8); applyTransform(enhancedImg,state.zoom.enhanced,state.pan.enhanced); });
  document.getElementById("enhReset").addEventListener("click", ()=>{ state.zoom.enhanced=1; state.pan.enhanced={x:0,y:0}; applyTransform(enhancedImg,1,state.pan.enhanced); });

  // Keyboard shortcuts
  window.addEventListener("keydown", (e)=>{
    const k = e.key.toLowerCase();
    if(k === "e" && !enhanceBtn.disabled) enhanceBtn.click();
    if(k === "b" && !bgRemoveBtn.disabled) bgRemoveBtn.click();
    if(k === "c" && !clearBtn.disabled) clearBtn.click();
    if(e.key === "Escape") { resetView(); fileInput.value = ""; }
  });

  // Quick improve from header
  document.getElementById("quickImprove").addEventListener("click", ()=>{
    if(!state.publicId) return;
    const prev = {...state.settings};
    state.settings.noise = Math.max(25, state.settings.noise - 5);
    state.settings.sharpen = Math.min(80, state.settings.sharpen + 6);
    enhanceBtn.click();
    setTimeout(()=>{ state.settings = prev; }, 2000);
  });

  // Menu actions (scroll / focus)
  document.getElementById("menuHome").addEventListener("click", ()=>{ window.scrollTo({top:0, behavior:"smooth"}); showToast("Inicio"); });
  document.getElementById("menuEditor").addEventListener("click", ()=>{ const el = document.getElementById("paneOriginal"); el && el.scrollIntoView({behavior:"smooth", block:"center"}); showToast("Editor"); });
  document.getElementById("menuPresets").addEventListener("click", ()=>{ showToast("Presets aún no configurados"); });
  document.getElementById("menuHelp").addEventListener("click", ()=>{ showToast("Ayuda: usa E/B/C/ESC o revisa la documentación"); });

  // Sync ranges and numbers
  function link(rangeEl, numEl, key){
    const sync = (val)=>{ rangeEl.value = val; numEl.value = val; state.settings[key] = parseInt(val,10); };
    rangeEl.addEventListener("input",(e)=> sync(e.target.value));
    numEl.addEventListener("input",(e)=>{ const v = clamp(parseInt(e.target.value||0,10), parseInt(rangeEl.min,10), parseInt(rangeEl.max,10)); sync(v); });
  }
  link(noiseRange, noiseNumber, "noise");
  link(sharpenRange, sharpenNumber, "sharpen");
  link(widthRange, widthNumber, "width");
  improveSwitch.addEventListener("change",(e)=> state.settings.improve = e.target.checked);
  upscaleSwitch.addEventListener("change",(e)=> state.settings.upscale = e.target.checked);

  // Intro loader animation (barra animada)
  (function introProgressFake(){
    // Animación "decorativa" que simula carga y no interfiere con el resto.
    let pct = 0;
    const step = () => {
      // increment variable amount to feel organic
      const inc = Math.max(1, Math.floor(Math.random() * 8));
      pct = Math.min(100, pct + inc);
      loaderBar.style.width = pct + "%";
      loaderEta.textContent = `Cargando — ${pct}%`;
      introLoader.querySelector('.bar').setAttribute('aria-valuenow', pct);
      if(pct < 100){
        setTimeout(step, 140 + Math.random()*360);
      } else {
        // give it a moment at 100%
        setTimeout(()=>{ introLoader.classList.add('hidden'); loaderBar.style.width = '0%'; loaderEta.textContent = `Cargando — 0%`; }, 420);
      }
    };
    // start shortly after load so page can initialize
    window.addEventListener('load', ()=> setTimeout(step, 220));
    // as fallback, run immediately if load didn't fire (embedding environments)
    setTimeout(()=>{ if(!document.readyState || document.readyState === 'complete') return; }, 800);
  })();

  // Expose for console debugging
  window.EnhanceStar = { state };

  // Init default UI state
  resetView();
  showToast("Bienvenido a Enhance Star — carga una imagen para comenzar", true);

})();
