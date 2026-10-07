const SUPABASE_URL="https://sxjswfvfwmibiumyrceb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_678HrTraImMobymHWNLq0Q_iSSqhh4O";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

let products = [
  {id:1,name:"Premium Cotton Shirt",category:"Shirts",price:899,badge:"NEW",images:[],sizes:["S","M","L","XL","XXL"],inventory:{}},
  {id:2,name:"Classic Casual Shirt",category:"Shirts",price:799,badge:"NEW",images:[],sizes:["S","M","L","XL","XXL"],inventory:{}},
  {id:3,name:"Slim Fit Shirt",category:"Shirts",price:999,badge:"NEW",images:[],sizes:["S","M","L","XL","XXL"],inventory:{}},
  {id:4,name:"Linen Blend Shirt",category:"Shirts",price:1199,badge:"NEW",images:[],sizes:["S","M","L","XL","XXL"],inventory:{}},
  {id:5,name:"Polo T-Shirt",category:"T-Shirts",price:699,badge:"",images:[],sizes:["S","M","L","XL","XXL"],inventory:{}},
  {id:6,name:"Premium Crew T-Shirt",category:"T-Shirts",price:799,badge:"",images:[],sizes:["S","M","L","XL","XXL"],inventory:{}},
  {id:7,name:"Classic Men's Kurta",category:"Kurtas",price:999,badge:"",images:[],sizes:["S","M","L","XL","XXL"],inventory:{}},
  {id:8,name:"Festive Kurta",category:"Kurtas",price:1299,badge:"TRENDING",images:[],sizes:["S","M","L","XL","XXL"],inventory:{}},
  {id:9,name:"Classic Denim Jeans",category:"Bottomwear",price:1299,badge:"TRENDING",images:[],sizes:["S","M","L","XL","XXL"],inventory:{}},
  {id:10,name:"Cargo Utility Pants",category:"Bottomwear",price:1199,badge:"",images:[],sizes:["S","M","L","XL","XXL"],inventory:{}}
];

let productsLoadedFromSupabase=false;
async function loadStoreProducts(){
  try{
    const {data,error}=await supabaseClient
      .from("products")
      .select("id,name,slug,description,price,compare_at_price,badge,sizes,category_id,is_active,categories(name)")
      .eq("is_active",true)
      .order("created_at",{ascending:false});
    if(error)throw error;
    if(!data?.length)return;

    const ids=data.map(p=>p.id);
    const [{data:images,error:imageError},{data:stock,error:stockError}]=await Promise.all([
      supabaseClient.from("product_images").select("product_id,image_url,sort_order,is_primary").in("product_id",ids).order("sort_order"),
      supabaseClient.from("inventory").select("product_id,size,stock_qty").in("product_id",ids)
    ]);
    if(imageError)console.warn("Product image load failed:",imageError.message);
    if(stockError)console.warn("Inventory load failed:",stockError.message);

    const imageMap={},stockMap={};
    (images||[]).forEach(x=>(imageMap[x.product_id]??=[]).push(x.image_url));
    (stock||[]).forEach(x=>{(stockMap[x.product_id]??={})[x.size]=Number(x.stock_qty||0);});

    products=data.map(p=>({
      id:p.id,
      name:p.name,
      category:p.categories?.name||"Uncategorized",
      price:Number(p.price||0),
      compare_at_price:p.compare_at_price,
      badge:p.badge||"",
      description:p.description||"",
      sizes:p.sizes||["S","M","L","XL","XXL"],
      images:imageMap[p.id]||[],
      inventory:stockMap[p.id]||{}
    }));
    productsLoadedFromSupabase=true;
    renderProducts();
  }catch(error){
    console.warn("Supabase catalog unavailable; using demo catalog.",error);
  }
}


let category="All";

let cart=[];
try{
  const savedCart=JSON.parse(localStorage.getItem("genzCart")||"[]");
  cart=Array.isArray(savedCart) ? savedCart.map(item=>({
    id:item.id,
    size:item.size,
    qty:item.qty||1
  })) : [];
}catch(error){
  localStorage.removeItem("genzCart");
  cart=[];
}
let current=null;
let selectedSize="M";
let currentView=1;
let touchStartX=0;

function img(p,v=1){
  if(p?.images?.length){
    return p.images[(v-1)%p.images.length] || p.images[0];
  }
  return typeof p?.id==="number" ? `Images/Product${String(p.id).padStart(2,"0")}/view${v}.jpg` : "";
}
}

function renderProducts(){
  const q=document.getElementById("search").value.toLowerCase();
  const list=products.filter(p=>
    (category==="All"||p.category===category) &&
    p.name.toLowerCase().includes(q)
  );
  document.getElementById("products").innerHTML=list.map(p=>{
    const image=img(p,1);
    const old=p.compare_at_price && Number(p.compare_at_price)>Number(p.price)
      ? `<span class="old">₹${Number(p.compare_at_price).toLocaleString("en-IN")}</span>` : "";
    return `
      <article class="card">
        <div class="card-img" onclick="openProduct('${String(p.id).replace(/'/g,"\\'")}')">
          ${p.badge ? `<span class="badge">${p.badge}</span>` : ""}
          <img src="${image}" alt="${p.name}" onerror="this.style.display='none'">
        </div>
        <div class="card-body">
          <div class="category">${p.category}</div>
          <h3>${p.name}</h3>
          <div class="price">₹${Number(p.price).toLocaleString("en-IN")}${old}</div>
          <button class="add" onclick="openProduct('${String(p.id).replace(/'/g,"\\'")}')">View Product</button>
        </div>
      </article>`;
  }).join("");
}
function openProduct(id){
  current=products.find(p=>String(p.id)===String(id));
  if(!current)return;

  selectedSize=(current.sizes||["S","M","L","XL","XXL"]).includes("M")?"M":(current.sizes||["S"])[0];
  currentView=1;

  document.getElementById("modalCategory").textContent=current.category;
  document.getElementById("modalName").textContent=current.name;
  document.getElementById("modalPrice").innerHTML=`₹${Number(current.price).toLocaleString("en-IN")} ${current.compare_at_price && Number(current.compare_at_price)>Number(current.price)?`<span class="old">₹${Number(current.compare_at_price).toLocaleString("en-IN")}</span>`:""}`;

  const imageList=current.images?.length?current.images:[1,2,3,4,5].map(v=>img(current,v));
  document.getElementById("mainImage").src=imageList[0];
  document.getElementById("thumbs").innerHTML=imageList.slice(0,5).map((url,i)=>`
    <img class="${i===0?"active":""}" src="${url}" alt="View ${i+1}" onclick="showView(${i+1})" onerror="this.style.display='none'">`).join("");

  const availableSizes=current.sizes||["S","M","L","XL","XXL"];
  document.querySelectorAll("#sizes button").forEach(b=>{
    const size=b.textContent;
    b.style.display=availableSizes.includes(size)?"":"none";
    b.classList.toggle("selected",size===selectedSize);
    b.disabled=availableSizes.includes(size) && Number(current.inventory?.[size]??0)<=0;
    b.title=b.disabled?"Out of stock":(current.inventory?.[size]!=null?`${current.inventory[size]} available`:"");
    b.onclick=()=>{
      if(b.disabled)return;
      selectedSize=size;
      document.querySelectorAll("#sizes button").forEach(x=>x.classList.remove("selected"));
      b.classList.add("selected");
      const selectedStock=Number(current.inventory?.[selectedSize]??0);
      if(addButton){
        addButton.textContent=selectedStock===0 && Object.keys(current.inventory||{}).length?"Out of Stock":"Add to Cart";
        addButton.disabled=selectedStock===0 && Object.keys(current.inventory||{}).length>0;
      }
    };
  });

  const addButton=document.querySelector("#productModal .primary-btn.full");
  const stock=Number(current.inventory?.[selectedSize]??0);
  if(addButton){
    addButton.textContent=stock===0 && Object.keys(current.inventory||{}).length?"Out of Stock":"Add to Cart";
    addButton.disabled=stock===0 && Object.keys(current.inventory||{}).length>0;
  }
  setupSlider();
  document.getElementById("productModal").classList.add("show");
}
function showView(v){
  if(!current)return;
  const count=current.images?.length || 5;
  if(v>count)v=1;
  if(v<1)v=count;
  currentView=v;
  document.getElementById("mainImage").src=img(current,currentView);
  document.querySelectorAll(".thumbs img").forEach((x,i)=>x.classList.toggle("active",i+1===currentView));
}
function addCurrentToCart(){
  if(!current)return;
  const stockKnown=Object.keys(current.inventory||{}).length>0;
  const available=Number(current.inventory?.[selectedSize]??0);
  const existing=cart.find(item=>String(item.id)===String(current.id)&&item.size===selectedSize);
  if(stockKnown && available<=0){
    alert("This size is currently out of stock.");
    return;
  }
  if(existing){
    const maxQty=stockKnown?Math.min(9,available):9;
    existing.qty=Math.min(maxQty,(existing.qty||1)+1);
  }else{
    cart.push({id:current.id,size:selectedSize,qty:1});
  }
  saveCart();
  closeProduct();
  openCart();
}

