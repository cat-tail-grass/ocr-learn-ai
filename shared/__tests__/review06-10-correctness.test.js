const path = require('path');
const root = process.env.OCR_REVIEW_BASELINE_ROOT || path.resolve(__dirname, '..');
const {createImageData} = require(path.join(root,'core/imageData'));
const {setPixel} = require(path.join(root,'core/pixelAccess'));
const m = require(path.join(root,'06-morphology'));
const d = require(path.join(root,'07-deskewing'));
const e = require(path.join(root,'08-edge-detection'));
const c = require(path.join(root,'09-connected-components'));
const t = require(path.join(root,'10-text-localization'));
function image(rows, foreground=0) {
    const bg=255-foreground, out=createImageData(rows[0].length,rows.length,bg,bg,bg);
    rows.forEach((row,y)=>Array.from(row).forEach((v,x)=>{if(+v) setPixel(out,x,y,foreground,foreground,foreground)}));
    return out;
}
const pixels = im => Array.from(im.data).filter((_,i)=>i%4===0);
const count = (im,foreground=0) => pixels(im).filter(v=>v===foreground).length;
const variance = im => d.calculateProjectionVariance(d.calculateHorizontalProjection(im));
const se = [[1,1,1],[1,1,1],[1,1,1]];

describe('06 集合形态学与亮度残差',()=>{
 test('黑前景腐蚀/膨胀须操作文字，不操作白背景',()=>{
    const a=image(['00000','00000','00100','00000','00000']);
    expect(count(m.erode(a,se,{foreground:'black'}))).toBe(0);
    expect(count(m.dilate(a,se,{foreground:'black'}))).toBe(9);
    expect(count(m.dilate(createImageData(3,3),se,{foreground:'black'}))).toBe(0);
 });
 test('非对称B中心+右邻居，膨胀向右；开运算不能向左平移',()=>{
    const b=[[0,0,0],[0,1,1],[0,0,0]];
    const a=image(['0000000','0001000','0000000'],255);
    expect(pixels(m.dilate(a,b)).slice(7,14)).toEqual([0,0,0,255,255,0,0]);
    const pair=image(['0000000','0001100','0000000'],255);
    expect(pixels(m.morphOpen(pair,b))).toEqual(pixels(pair));
 });
 test('矩形核1×3须使用独立高宽与锚点',()=>{
    const a=image(['00000','00100','00000'],255);
    expect(count(m.dilate(a,[[1,1,1]]),255)).toBe(3);
 });
 test('闭运算中间扩边，贴边前景不能消失',()=>{
    const a=image(['100','000','000'],255);
    expect(pixels(m.morphClose(a,se))).toEqual(pixels(a));
    const black=image(['100','000','000']);
    expect(pixels(m.morphClose(black,se,{foreground:'black'}))).toEqual(pixels(black));
 });
 test('3×3圆盘与十字一致；二值帽输出白残差',()=>{
    expect(m.createStructuringElement('ellipse',3)).toEqual([[0,1,0],[1,1,1],[0,1,0]]);
    const dark=image(['00000','00000','00100','00000','00000']);
    const bright=image(['00000','00000','00100','00000','00000'],255);
    expect(count(m.blackHat(dark,se),255)).toBe(1);
    expect(count(m.topHat(bright,se),255)).toBe(1);
    // 5×5白环厚度仅2，任何3×3窗口都碰到黑点或图外背景；开运算为空。
    expect(count(m.topHat(dark,se),255)).toBe(24);
    // 足够宽的白色背景可容纳3×3核，孤立黑点不是白顶帽细节。
    const largeDark=createImageData(9,9);setPixel(largeDark,4,4,0,0,0);
    expect(count(m.topHat(largeDark,se),255)).toBe(0);
 });
});

describe('07 角度/坐标/边界',()=>{
 test.each(['nearest','bilinear'])('零角%s逐像素恒等，覆盖所有边界和1×1',kind=>{
    for(const [w,h] of [[1,1],[1,4],[4,1],[4,3]]){
       const a=createImageData(w,h,0,0,0);
       for(let y=0;y<h;y++)for(let x=0;x<w;x++)setPixel(a,x,y,(y*w+x)*7,(y*w+x)*7,(y*w+x)*7);
       expect(pixels(d.rotateImage(a,0,kind))).toEqual(pixels(a));
    }
 });
 test('正90°视觉逆时针，绕像素网格中心',()=>{
    const a=image(['00000','00000','00001','00000','00000']);
    expect(pixels(d.rotateImage(a,90,'nearest'))).toEqual(pixels(image(['00100','00000','00000','00000','00000'])));
 });
 test('双线性边界逐tap使用指定背景',()=>{
    const a=createImageData(1,1,100,100,100);
    expect(d.bilinearInterpolate(a,0,0,255)).toBe(100);
    expect(d.bilinearInterpolate(a,-0.5,0,200)).toBe(150);
 });
 test.each([7,-7])('模拟%d°后直接用检测角校正且方差增加',angle=>{
    const a=createImageData(100,70);
    for(const y of [15,30,45])for(let dy=0;dy<3;dy++)for(let x=15;x<85;x++)setPixel(a,x,y+dy,0,0,0);
    const skew=d.rotateImage(a,angle,'nearest');
    const detected=d.detectSkewAngle(skew);
    const result=d.deskew(skew,{interpolation:'nearest'});
    expect(Math.abs(detected.angle+angle)).toBeLessThan(0.5);
    expect(result.correctionAngle).toBe(detected.angle);
    expect(result.skewAngle).toBe(-detected.angle);
    expect(variance(result.imageData)).toBeGreaterThan(variance(skew)*3);
 });
 test('细化不越过搜索界限；空白不凭空转向',()=>{
    const a=createImageData(80,40);for(let x=5;x<75;x++)setPixel(a,x,20,0,0,0);
    const skew=d.rotateImage(a,10,'nearest');
    const r=d.detectSkewAngle(skew,{minAngle:-4,maxAngle:4,step:2});
    expect(r.angle).toBeGreaterThanOrEqual(-4);
    expect(r.angle).toBeLessThanOrEqual(4);
    expect(d.detectSkewAngle(createImageData(4,4)).angle).toBe(0);
 });
 test('霍夫角度总票数恒定，峰值能区分方向',()=>{
    const a=createImageData(100,60);for(let x=10;x<90;x++)setPixel(a,x,30,0,0,0);
    const h=d.houghTransform(a);
    expect(new Set(h.accumulator.map(row=>row.reduce((a,b)=>a+b,0)))).toEqual(new Set([80]));
    expect(d.detectSkewAngleByHough(a).angle).toBe(0);
    const skew=d.rotateImage(a,7,'nearest');
    expect(Math.abs(d.detectSkewAngleByHough(skew).angle+7)).toBeLessThanOrEqual(1);
 });
});

describe('08 梯度方向与滞后连通',()=>{
 test.each([45,135,-45,-135])('NMS按y向下的%d°比较对角邻居',angle=>{
    const mag=new Float32Array(9);mag[4]=5;
    const rising=angle===45||angle===-135;
    mag[rising?0:2]=9;mag[rising?8:6]=9;
    expect(e.nonMaxSuppression(mag,new Float32Array(9).fill(angle),3,3)[4]).toBe(0);
 });
 test('Sobel手算270/70、方向14.53°，不是错的外积分解',()=>{
    const a=createImageData(3,3);[[50,50,100],[50,60,120],[50,70,130]].forEach((row,y)=>row.forEach((v,x)=>setPixel(a,x,y,v,v,v)));
    const g=e.computeGradient(a,e.createSobelKernelX(),e.createSobelKernelY());
    expect(g.gx[4]).toBe(270);expect(g.gy[4]).toBe(70);expect(g.direction[4]).toBeCloseTo(14.534,2);
 });
 test('边界强点可带动多跳弱边缘，孤立弱点舍弃',()=>{
    const strong=new Uint8Array(25),weak=new Uint8Array(25);strong[0]=1;weak[6]=1;weak[12]=1;weak[24]=1;
    const out=e.hysteresisTracking(strong,weak,5,5);
    expect([out[0],out[6],out[12],out[24]]).toEqual([1,1,1,0]);
 });
 test('低阈值0不把平坦背景接成满幅边缘',()=>{
    const a=createImageData(8,8,100,100,100);
    expect(e.cannyEdgeDetection(a,{lowThreshold:0,highThreshold:0}).edgeCount).toBe(0);
 });
});

// 独立BFS参考，不依赖two-pass/并查集实现或标签编号。
function bfsPartition(rows, connectivity){
 const h=rows.length,w=rows[0].length, groups=[],seen=new Set();
 for(let i=0;i<w*h;i++){
  if(seen.has(i)||rows[Math.floor(i/w)][i%w]!=='1')continue;
  const group=[i];seen.add(i);
  for(let k=0;k<group.length;k++){
   const x=group[k]%w,y=Math.floor(group[k]/w);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if((dx===0&&dy===0)||(connectivity===4&&Math.abs(dx)+Math.abs(dy)!==1))continue;
    const xx=x+dx,yy=y+dy,ni=yy*w+xx;
    if(xx>=0&&xx<w&&yy>=0&&yy<h&&!seen.has(ni)&&rows[yy][xx]==='1'){seen.add(ni);group.push(ni)}
   }
  }
  groups.push(group.sort((a,b)=>a-b));
 }
 return groups;
}
describe('09 连通性独立穷举和讲义算例',()=>{
 test('3×3的全部512种二值图，4/8连通分区均等于独立BFS',()=>{
    for(let bits=0;bits<512;bits++)for(const conn of [4,8]){
      const rows=Array.from({length:3},(_,y)=>Array.from({length:3},(_,x)=>String((bits>>(y*3+x))&1)).join(''));
      const r=c.labelConnectedComponents(image(rows),conn);
      const groups=Array.from({length:r.numLabels},(_,j)=>Array.from(r.labels).flatMap((v,i)=>v===j+1?[i]:[]));
      expect(groups).toEqual(bfsPartition(rows,conn));
    }
 });
 test('斜桥Two-Pass例子为8连通1域/4连通3域，几何量可手算',()=>{
    const a=image(['11011','11011','00100','11111']);const r=c.labelConnectedComponents(a,8);
    expect(r.numLabels).toBe(1);expect(c.labelConnectedComponents(a,4).numLabels).toBe(3);
    expect(c.extractRegionProperties(r.labels,r.numLabels,5,4)[0]).toMatchObject({area:14,boundingBox:{x:0,y:0,width:5,height:4},centroid:{x:2,y:1.5},fillRatio:.7});
 });
 test('拒绝无效连通性，不能静默当成4连通',()=>expect(()=>c.labelConnectedComponents(image(['1']),6)).toThrow());
});

describe('10 投影边界、筛选与阅读顺序',()=>{
 test('末行/末列单像素区域正确闭合',()=>{
    const a=image(['000','000','001']);
    expect(t.detectTextLines(a,{minLineHeight:1})).toEqual([{x:2,y:2,width:1,height:1}]);
    expect(t.segmentCharacters(a,{x:0,y:0,width:3,height:3},{minCharWidth:1})).toEqual([{x:2,y:0,width:1,height:3}]);
 });
 test('带非零x/y偏移的字符分割返回全图坐标',()=>{
    const a=image(['000000','001001','001001','000000']);
    expect(t.segmentCharacters(a,{x:2,y:1,width:4,height:2},{minCharWidth:1,gapThreshold:0})).toEqual([{x:2,y:1,width:1,height:2},{x:5,y:1,width:1,height:2}]);
 });
 test('候选筛选必须影响最终字符且保留洞',()=>{
    const a=image(['000000000','011100100','010100100','011100000','000000000']);
    const r=t.localizeText(a,{minArea:3,minLineHeight:1,minCharWidth:1,projectionThreshold:0,gapThreshold:0});
    expect(r.characters).toEqual([{x:1,y:1,width:3,height:3}]);
    expect(pixels(r.filteredImageData)[2*9+2]).toBe(255);
    expect(t.localizeText(a,{minArea:100,minLineHeight:1,minCharWidth:1}).characters).toEqual([]);
 });
 test('RLSA仅填两端包夹且≤阈值的间隙，水平/垂直一致',()=>{
    const row='001001000010100';const expected='001111000011100';
    expect(pixels(t.horizontalRLSA(image([row]),2))).toEqual(pixels(image([expected])));
    expect(pixels(t.verticalRLSA(image(Array.from(row)),2))).toEqual(pixels(image(Array.from(expected))));
 });
 test('先分行再排序，所有输入排列给出同一顺序',()=>{
    const a={x:20,y:0,width:2,height:10},b={x:10,y:4,width:2,height:10},cc={x:0,y:8,width:2,height:10};
    for(const order of [[a,b,cc],[a,cc,b],[b,a,cc],[b,cc,a],[cc,a,b],[cc,b,a]]){
      expect(t.sortCharacters(order,{lineThreshold:5})).toEqual([b,a,cc]);
    }
 });
});
