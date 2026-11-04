/** Decode with an image element for mobile browsers that lack createImageBitmap. */
export async function prepareImage(file:File,{maxDimension=1600,maxBytes=1024*1024,square=false}:{maxDimension?:number;maxBytes?:number;square?:boolean}={}):Promise<Blob>{
 if(!/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.type)||file.size>20*1024*1024)throw Error('Choose an image under 20 MB.');
 const url=URL.createObjectURL(file),image=new Image();image.decoding='async';
 try{await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('This image could not be opened. Try a JPG, PNG or WebP image.'));image.src=url});if(!image.naturalWidth||!image.naturalHeight)throw Error('This image is empty.');
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('This image could not be prepared.');const side=Math.min(image.naturalWidth,image.naturalHeight),scale=Math.min(1,maxDimension/(square?side:Math.max(image.naturalWidth,image.naturalHeight)));canvas.width=Math.max(1,Math.round((square?side:image.naturalWidth)*scale));canvas.height=Math.max(1,Math.round((square?side:image.naturalHeight)*scale));ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);if(square)ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,canvas.width,canvas.height);else ctx.drawImage(image,0,0,canvas.width,canvas.height);
 for(const quality of [.82,.68,.5,.35]){const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=maxBytes)return blob}throw Error('This image is too large after resizing. Choose a smaller image.');
 }finally{URL.revokeObjectURL(url)}
}
