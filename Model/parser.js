import{unzipSync}from"node:zlib";export class Parser{uin;message=[];brief="";content="";anon;extra;quotation;atme=!1;atall=!1;newImg=!1;imgprefix={};exclusive=!1;it;constructor(e,t){this.uin=t,Array.isArray(e)?this.parseElems(e):(e[4]&&e[4].length&&this.parseExclusiveElem(0,e[4]),this.parseElems(Array.isArray(e[2])?e[2]:[e[2]]))}getNextText(){try{var e=this.it?.next().value[1][1];return String(e[1])}catch{return"[未知]"}}parseExclusiveElem(e,t){let i,s;switch(e){case 12:case 51:var a=t[1].toBuffer();i={type:12===e?"xml":"json",data:String(0<a[0]?unzipSync(a.slice(1)):a.slice(1)),id:t[2]},s=i.type+"消息",this.content=i.data;break;case 3:i=this.parseNewImgElem(t,"flash"),s="闪照",this.content=`{flash:${i.file.slice(0,32).toUpperCase()}}`;break;case 0:i={type:"record",file:"protobuf://"+t.toBase64(),url:"",md5:t[4].toHex(),size:t[6]||0,seconds:t[19]||0},t[20]&&(a=String(t[20]),i.url=a.startsWith("http")?a:"https://grouptalk.c2c.qq.com"+a),s="语音",this.content=`{ptt:${i.url}}`;break;case 19:i={type:"video",file:"protobuf://"+t.toBase64(),name:t[3]?.toString()||"",fid:String(t[1]),md5:t[2].toBase64(),size:t[6]||0,seconds:t[5]||0},s="视频",this.content=`{video:${i.fid}}`;break;case 5:a=this.core.pb.decode(t[2].toBuffer().slice(3))[7][2],i={type:"file",name:String(a[4]),fid:String(a[2]).replace("/",""),md5:String(a[8]),size:a[3],duration:a[5]},s="群文件",this.content=`{file:${i.fid}}`;break;case 37:(i={type:"face",id:t[2][3],text:t[2][7]?String(t[2][7]):"超级表情",big:!0}).text||(i.text=t[2][7]?String(t[2][7]):"超级表情"),t[2][2]&&(i.stickerId=String(t[2][2]),i.stickerType=t[2][5]),s=i.text,this.content=`{face:${i.id},text:${i.text}}`;break;case 126:if(!t[3])return;a=126===t[3]?t[2][4]:t[3],i={type:"poke",id:a,text:this.face.pokemap[a]},s=this.face.pokemap[a],this.content=`{poke:${i.id}}`;break;default:return}this.message=[i],this.brief="["+s+"]"}parsePartialElem(e,i){let s,a="",r="";switch(e){case 1:a=String(i[1]);var t=i[3]?.toBuffer();if(t&&1===t[1])s={type:"at",qq:0,text:a},1===t[6]?(s.qq="all",this.atall=!0):(s.qq=t.readUInt32BE(7),s.qq===this.uin&&(this.atme=!0)),a=a||"@"+s.qq,r=`{at:${s.qq}}`;else{if(!a)return;r=a,s={type:"text",text:a}}break;case 2:s={type:"face",id:i[1],text:this.face.facemap[i[1]].text||"表情"},a=`[${s.text}]`,r=`{face:${s.id}}`;break;case 33:s={type:"face",id:i[1],text:i[2]||"/"+i[1]},a=`[${s.text}]`,r=`{face:${s.id}}`;break;case 6:a=this.getNextText(),r=a.includes("骰子")||a.includes("猜拳")?`{${(s={type:a.includes("骰子")?"dice":"rps",id:i[12].toBuffer()[16]-48+1}).type}:${s.id}}`:`{bface:${(s={type:"bface",file:i[4].toHex()+i[7].toHex()+i[5],text:a.replace(/[[\]]/g,"")}).text}}`;break;case 4:case 8:if(this.newImg)return;s=this.parseImgElem(e,i,"image"),a=(s.asface?"[动画表情]":"[图片]")+(s.summary||""),r=`{image:${s.md5.toUpperCase()}}`;break;case 31:if(103904510!==i[3])return;s={type:"mirai",data:String(i[2])};break;case 34:a=this.getNextText(),s={type:"sface",id:i[1],text:a.replace(/[[\]]/g,"")},r=`{sface:${s.id}}`;break;case 37:if(2!=i[6])return;s={type:"long_msg",resid:i[7]?.toString()};break;case 45:i=i[2],s={type:"markdown",content:i[1]?.toString(),...i[2]?{config:{unknown:i[2][1]||1,time:i[2][2]||0,token:i[2][3]?.toHex()||""}}:{}},a="[markdown消息]",r=a;break;case 46:i=i[2];try{var c=Array.isArray(i[1][1])?i[1][1]:[i[1][1]];s={type:"button",content:{appid:Number(i[1][2])||0,rows:c.map(e=>{var t,i=[];for(t of e=Array.isArray(e[1])?e[1]:[e[1]]){var s={id:"",render_data:{},action:{permission:{}}};t[1]&&(s.id=t[1]?.toString()),t[2]&&(s.render_data.label=t[2][1]?.toString(),s.render_data.visited_label=t[2][2]?.toString(),s.render_data.style=Number(t[2][3])||0),t[3]&&(s.action.type=Number(t[3][1])||0,s.action.unsupport_tips=t[3][4]?.toString(),s.action.data=t[3][5]?.toString(),s.action.reply=1===t[3][7],s.action.enter=1===t[3][8],t[3][2])&&(s.action.permission.type=Number(t[3][2][1])||0,s.action.permission.specify_role_ids=t[3][2][2]||[],s.action.permission.specify_user_ids=t[3][2][3]||[]),i.push(s)}return{buttons:i}})}},a="[button消息]",r=a}catch{return}break;case 48:switch(i[3]){case 10:case 20:if(!(s=this.parseNewImgElem(i[2],"image")))return;a=(s.asface?"[动画表情]":"[图片]")+(s.summary||""),r=`{image:${s.md5.toUpperCase()}}`;break;case 11:case 21:let e=i[2][1],t=(e=Array.isArray(e)?e:[e]).find(e=>100!==e[1][6]);s={type:"video",file:"protobuf://"+i[2].toBase64(),fid:t[1],md5:"ntvideo",size:0,seconds:0},a="视频",r=`{video:${s.file}}`;break;case 12:case 22:s={type:"record",file:i[2][1][1],url:"",md5:"ntptt",size:0,seconds:0},a="语音",r="{ptt:ntptt}";break;default:return}break;case 500:i=i[2],s={type:"forum",id:String(i[44][3]),create_time:Math.floor(i[44][5]/1e3)},a="[频道帖子]",r=`{forum:${s.id}}`;break;default:return}2===this.message.length&&"at"===s.type&&"at"===this.message[0]?.type&&"text"===this.message[1]?.type&&this.message[0].qq===s.qq&&" "===this.message[1].text&&(this.message.splice(0,2),this.brief=""),this.brief+=a,this.content+=r,Array.isArray(this.message)||(this.message=[]);var n=this.message[this.message.length-1];"text"===s.type&&"text"===n?.type?n.text+=s.text:this.message.push(s)}parseElems(e){for(this.it=e.entries();;){var t=this.it.next().value?.[1];if(!t)break;var i=Number(Object.keys(Reflect.getPrototypeOf(t))[0]),s=t[i];if(16===i)this.extra=s;else if(21===i)this.anon=s;else if(45===i)this.quotation=s;else if(!this.exclusive)switch(i){case 1:case 2:case 4:case 6:case 8:case 31:case 34:case 37:this.parsePartialElem(i,s);break;case 5:case 12:case 19:case 51:this.parseExclusiveElem(i,s);break;case 53:3===s[1]?this.parseExclusiveElem(3,s[2][1]||s[2][2]):33===s[1]?this.parsePartialElem(33,s[2]):2===s[1]?this.parseExclusiveElem(126,s):37===s[1]?this.parseExclusiveElem(37,s):20===s[1]?this.parseExclusiveElem(51,s[2]):[45,46,48,500].includes(s[1])&&this.parsePartialElem(s[1],s)}}}parseNewImgElem(e,t){try{var i={type:t,file:e[1][1][1][4]?.toString(),url:"",file_id:e[1][1][2]?.toString(),md5:e[1][1][1][2]?.toString(),height:e[1][1][1][7],width:e[1][1][1][6],size:e[1][1][1][1],summary:e[2][1]?.[2]?.toString()},s=("image"===t&&(i.asface=1===e[2][1]?.[1]),i.file=this.image.buildImageFileParam(i.md5,i.size,i.width,i.height,e[1][1][1][5][2]),((e[2][1]?.[11]||e[2][1]?.[12])?.[30]||"").toString());if(s?.length)return this.newImg=!0,i.url="https://"+e[1][2][3]+(0===s.indexOf("/")?s:""+e[1][2][1]+s)+(e[1][2][2][1]||"&spec=0"),i;i.md5&&(i.url="https://"+e[1][2][3]+e[1][2][1],this.imgprefix[i.md5]=i)}catch{if("flash"===t)return this.parseImgElem(0,e,t)}}parseImgElem(e,t,i){let s;var a,r=t[(e="flash"===i?!!t[1]:8!==e)?7:13].toHex(),c=(t[e?29:34]?.[30]||"").toString();return this.imgprefix[r]&&c?.length?(a=this.imgprefix[r].url?.length?new URL(this.imgprefix[r].url).origin:"",s={...this.imgprefix[r],type:i,url:`${0===c.indexOf("/")?""+a+c:""+this.imgprefix[r].url+c}&spec=0`}):((s={type:i,file:"",url:"",md5:r,height:t[e?8:23],width:t[e?9:22],size:t[e?2:25],summary:t[e?29:34]?.[e?8:9]?.toString()}).file=this.image.buildImageFileParam(s.md5,s.size,s.width,s.height,t[e?5:20]),"image"===i&&(s.asface=1===t[e?29:34]?.[1]),s.url||(c?c.toString().includes("fileid")?s.url=`https://c2cpicdw.qpic.cn${c}&spec=0`:s.url="https://c2cpicdw.qpic.cn"+t[16]:t[16]?s.url="https://gchat.qpic.cn"+t[16]:t[15]?s.url="https://c2cpicdw.qpic.cn"+t[15]:s.url=`https://gchat.qpic.cn/gchatpic_new/0/0-0-${r.toUpperCase()}/0`),s)}}