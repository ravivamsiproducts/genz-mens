let products = [
  {id:1,name:"Premium Cotton Shirt",category:"Shirts",price:899,badge:"NEW"},
  {id:2,name:"Classic Casual Shirt",category:"Shirts",price:799,badge:"NEW"},
  {id:3,name:"Slim Fit Shirt",category:"Shirts",price:999,badge:"NEW"},
  {id:4,name:"Linen Blend Shirt",category:"Shirts",price:1199,badge:"NEW"},
  {id:5,name:"Polo T-Shirt",category:"T-Shirts",price:699,badge:""},
  {id:6,name:"Premium Crew T-Shirt",category:"T-Shirts",price:799,badge:""},
  {id:7,name:"Classic Men's Kurta",category:"Kurtas",price:999,badge:""},
  {id:8,name:"Festive Kurta",category:"Kurtas",price:1299,badge:"TRENDING"},
  {id:9,name:"Classic Denim Jeans",category:"Bottomwear",price:1299,badge:"TRENDING"},
  {id:10,name:"Cargo Utility Pants",category:"Bottomwear",price:1199,badge:""}
];

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
  return `Images/Product${String(p.id).padStart(2,"0")}/view${v}.jpg`;
}

function renderProducts(){

  const q=document.getElementById("search").value.toLowerCase();

  const list=products.filter(p=>
    (category==="All"||p.category===category) &&
    p.name.toLowerCase().includes(q)
  );

  document.getElementById("products").innerHTML=list.map(p=>`

    <article class="card">

      <div class="card-img" onclick="openProduct(${p.id})">

        ${p.badge ? `<span class="badge">${p.badge}</span>` : ""}

        <img
          src="${img(p)}"
          alt="${p.name}"
          onerror="this.style.display='none'"
        >

      </div>

      <div class="card-body">

        <div class="category">${p.category}</div>

        <h3>${p.name}</h3>

        <div class="price">
          ₹${p.price.toLocaleString("en-IN")}
        </div>

        <button class="add" onclick="openProduct(${p.id})">
          View Product
        </button>

      </div>

    </article>

  `).join("");
}

function setCategory(c,el){

  category=c;

  document
    .querySelectorAll(".filter")
    .forEach(x=>x.classList.remove("active"));

  el.classList.add("active");

  renderProducts();
}

function openProduct(id){

  current=products.find(p=>p.id===id);

  selectedSize="M";
  currentView=1;

  document.getElementById("modalCategory").textContent=
    current.category;

  document.getElementById("modalName").textContent=
    current.name;

  document.getElementById("modalPrice").textContent=
    `₹${current.price.toLocaleString("en-IN")}`;

  document.getElementById("mainImage").src=
    img(current,1);

  document.getElementById("thumbs").innerHTML=
    [1,2,3,4,5].map((v,i)=>`

      <img
        class="${i===0?"active":""}"
        src="${img(current,v)}"
        alt="View ${v}"
        onclick="showView(${v})"
        onerror="this.style.display='none'"
      >

    `).join("");

  document
    .querySelectorAll("#sizes button")
    .forEach(b=>{

      b.classList.toggle(
        "selected",
        b.textContent===selectedSize
      );

      b.onclick=()=>{

        selectedSize=b.textContent;

        document
          .querySelectorAll("#sizes button")
          .forEach(x=>x.classList.remove("selected"));

        b.classList.add("selected");

      };

    });

  setupSlider();

  document
    .getElementById("productModal")
    .classList.add("show");
}

function setupSlider(){

  const gallery=document.querySelector(".gallery");

  const mainImage=document.getElementById("mainImage");

  if(!gallery || !mainImage) return;

  if(!gallery.querySelector(".slider-arrow.left")){

    const left=document.createElement("button");

    left.className="slider-arrow left";

    left.type="button";

    left.innerHTML="‹";

    left.setAttribute(
      "aria-label",
      "Previous image"
    );

    left.onclick=()=>{
      showView(currentView-1);
    };

    const right=document.createElement("button");

    right.className="slider-arrow right";

    right.type="button";

    right.innerHTML="›";

    right.setAttribute(
      "aria-label",
      "Next image"
    );

    right.onclick=()=>{
      showView(currentView+1);
    };

    gallery.insertBefore(left,mainImage);

    gallery.insertBefore(right,mainImage);

    mainImage.addEventListener(
      "touchstart",
      e=>{
        touchStartX=
          e.changedTouches[0].screenX;
      },
      {passive:true}
    );

    mainImage.addEventListener(
      "touchend",
      e=>{

        const touchEndX=
          e.changedTouches[0].screenX;

        const distance=
          touchEndX-touchStartX;

        if(Math.abs(distance)>45){

          if(distance<0){

            showView(currentView+1);

          }else{

            showView(currentView-1);

          }

        }

      },
      {passive:true}
    );
  }
}

function showView(v){

  if(!current) return;

  if(v>5) v=1;

  if(v<1) v=5;

  currentView=v;

  document.getElementById("mainImage").src=
    img(current,currentView);

  document
    .querySelectorAll(".thumbs img")
    .forEach((x,i)=>{

      x.classList.toggle(
        "active",
        i+1===currentView
      );

    });
}

function closeProduct(){

  document
    .getElementById("productModal")
    .classList.remove("show");
}

function addCurrentToCart(){

  const existing=cart.find(item=>
    item.id===current.id && item.size===selectedSize
  );

  if(existing){
    existing.qty=Math.min(9,(existing.qty||1)+1);
  }else{
    cart.push({
      id:current.id,
      size:selectedSize,
      qty:1
    });
  }

  saveCart();
  closeProduct();
  openCart();
}

function saveCart(){

  localStorage.setItem(
    "genzCart",
    JSON.stringify(cart)
  );

  const count=cart.reduce((sum,item)=>sum+(item.qty||1),0);
  document.getElementById("cartCount").textContent=count;
}

function openCart(){

  renderCart();

  document
    .getElementById("cartModal")
    .classList.add("show");
}

function closeCart(){

  document
    .getElementById("cartModal")
    .classList.remove("show");
}

function renderCart(){

  const box=document.getElementById("cartItems");
  let total=0;

  if(!cart.length){
    box.innerHTML="<p class='muted'>Your cart is empty.</p>";
    document.getElementById("cartTotal").textContent="₹0";
    return;
  }

  box.innerHTML=cart.map((item,i)=>{

    const p=products.find(x=>x.id===item.id);
    const qty=item.qty||1;
    total+=p.price*qty;

    return `
      <div class="cart-row">

        <img src="${img(p)}">

        <div class="cart-product-info">
          <b>${p.name}</b>
          <div class="category">Size: ${item.size}</div>

          <div class="cart-qty">
            <button type="button" onclick="changeQty(${i},-1)" aria-label="Decrease quantity">−</button>
            <strong>${qty}</strong>
            <button type="button" onclick="changeQty(${i},1)" aria-label="Increase quantity" ${qty>=9?"disabled":""}>+</button>
            <span>Max 9</span>
          </div>
        </div>

        <strong class="cart-price">
          ₹${(p.price*qty).toLocaleString("en-IN")}
        </strong>

        <button class="remove" onclick="removeItem(${i})">Remove</button>

      </div>
    `;
  }).join("");

  document.getElementById("cartTotal").textContent=
    `₹${total.toLocaleString("en-IN")}`;
}

function removeItem(i){

  cart.splice(i,1);
  saveCart();
  renderCart();
}

function changeQty(i,change){

  if(!cart[i]) return;

  const next=Math.max(1,Math.min(9,(cart[i].qty||1)+change));
  cart[i].qty=next;

  saveCart();
  renderCart();
}

function checkout(){

  if(!cart.length){
    alert("Your cart is empty.");
    return;
  }

  renderCheckout();

  closeCart();

  document
    .getElementById("checkoutModal")
    .classList.add("show");
}

function closeCheckout(){

  document
    .getElementById("checkoutModal")
    .classList.remove("show");
}

function renderCheckout(){

  const box=document.getElementById("checkoutItems");
  let total=0;

  box.innerHTML=cart.map(item=>{

    const p=products.find(x=>x.id===item.id);
    const qty=item.qty||1;
    total+=p.price*qty;

    return `
      <div class="checkout-item">
        <img src="${img(p)}" alt="${p.name}">
        <div class="checkout-item-info">
          <b>${p.name}</b>
          <span>Size: ${item.size} • Qty: ${qty}</span>
        </div>
        <strong class="checkout-item-price">₹${(p.price*qty).toLocaleString("en-IN")}</strong>
      </div>
    `;
  }).join("");

  document.getElementById("checkoutSubtotal").textContent=
    `₹${total.toLocaleString("en-IN")}`;

  document.getElementById("checkoutTotal").textContent=
    `₹${total.toLocaleString("en-IN")}`;
}

let pincodeLookupTimer=null;

function setPinStatus(message,type=""){
  const status=document.getElementById("pinStatus");
  if(!status) return;
  status.textContent=message;
  status.className="pin-status "+type;
}

function lookupPincode(){
  const input=document.getElementById("pincode");
  if(!input) return;

  const pincode=input.value.replace(/\D/g,"").slice(0,6);
  input.value=pincode;
  clearTimeout(pincodeLookupTimer);

  if(pincode.length<6){
    setPinStatus("PIN will help auto-fill City & State.");
    return;
  }

  setPinStatus("Looking up PIN code…","loading");

  pincodeLookupTimer=setTimeout(async()=>{
    try{
      const response=await fetch(`https://api.pincodeapi.in/api/v1/pincode/${pincode}`);
      if(!response.ok) throw new Error("PIN lookup failed");

      const result=await response.json();
      if(!result.success || !result.data || !result.data.post_offices?.length){
        throw new Error("PIN not found");
      }

      const office=result.data.post_offices[0];
      const city=document.getElementById("city");
      const state=document.getElementById("state");

      if(city && office.district) city.value=office.district;
      if(state && office.state) state.value=office.state;

      setPinStatus(
        "✓ City & State auto-filled. You can edit them if needed.",
        "success"
      );
    }catch(error){
      setPinStatus(
        "PIN not found. Please enter City & State manually.",
        "error"
      );
    }
  },350);
}


function placeOrder(event){
  event.preventDefault();
  const form=document.getElementById("checkoutForm");
  if(!form.checkValidity()){form.reportValidity();return;}
  pendingCheckout={
    customer_name:document.getElementById("customerName").value.trim(),
    customer_phone:document.getElementById("customerPhone").value.trim(),
    customer_email:document.getElementById("customerEmail").value.trim(),
    address_line:document.getElementById("addressLine").value.trim(),
    area_locality:document.getElementById("street").value.trim(),
    pincode:document.getElementById("pincode").value.trim(),
    city:document.getElementById("city").value.trim(),
    state:document.getElementById("state").value.trim()
  };
  renderPayment();
  document.getElementById("checkoutModal").classList.remove("show");
  document.getElementById("paymentModal").classList.add("show");
}

const GENZ_UPI_ID="ravivamsi@ybl"; // GenZ Men merchant UPI ID
const COD_UPI_ADVANCE=100;
let selectedPayment="UPI";
let pendingCheckout=null;

function cartSubtotal(){
  return cart.reduce((sum,item)=>{
    const p=products.find(x=>String(x.id)===String(item.id));
    return sum+(p?Number(p.price||0)*(item.qty||1):0);
  },0);
}

function paymentBreakdown(){
  const subtotal=cartSubtotal();
  if(selectedPayment==="COD"){
    return {subtotal,delivery:COD_UPI_ADVANCE,upfront:COD_UPI_ADVANCE,due:subtotal,total:subtotal+COD_UPI_ADVANCE};
  }
  if(selectedPayment==="UPI Advance + COD"){
    let advance=Number(document.getElementById("partialAdvanceAmount")?.value||0);
    advance=Math.max(100,Math.floor(advance||100));
    if(subtotal<=100)advance=Math.max(0,subtotal-1);
    advance=Math.min(advance,Math.max(0,subtotal-1));
    return {subtotal,delivery:0,upfront:advance,due:Math.max(0,subtotal-advance),total:subtotal};
  }
  return {subtotal,delivery:0,upfront:subtotal,due:0,total:subtotal};
}

function upiPaymentUrl(amount,orderNumber){
  if(!GENZ_UPI_ID)return "";
  const params=new URLSearchParams({
    pa:GENZ_UPI_ID,pn:"GenZ Men's",am:Number(amount).toFixed(2),cu:"INR",
    tn:"GenZ Men's "+orderNumber
  });
  return "upi://pay?"+params.toString();
}

function openUpiPayment(amount,orderNumber){
  const url=upiPaymentUrl(amount,orderNumber);
  if(!url){
    alert("UPI payment is not configured yet. Add the GenZ Men's merchant UPI ID in script.js before accepting online/advance payments.");
    return false;
  }
  window.location.href=url;
  return true;
}

function renderPayment(){
  const box=document.getElementById("paymentItems");
  box.innerHTML=cart.map(item=>{
    const p=products.find(x=>String(x.id)===String(item.id));
    const qty=item.qty||1;
    return '<div class="checkout-item"><img src="'+img(p)+'" alt="'+p.name+'"><div class="checkout-item-info"><b>'+p.name+'</b><span>Size: '+item.size+' • Qty: '+qty+'</span></div><strong class="checkout-item-price">₹'+(Number(p.price||0)*qty).toLocaleString("en-IN")+'</strong></div>';
  }).join("");
  const b=paymentBreakdown();
  document.getElementById("paymentSubtotal").textContent="₹"+b.subtotal.toLocaleString("en-IN");
  document.getElementById("paymentDelivery").textContent=b.delivery?"₹"+b.delivery.toLocaleString("en-IN"):"FREE";
  document.getElementById("paymentAdvance").textContent="₹"+b.upfront.toLocaleString("en-IN");
  document.getElementById("paymentDue").textContent="₹"+b.due.toLocaleString("en-IN");
  document.getElementById("paymentTotal").textContent="₹"+b.total.toLocaleString("en-IN");
  const dueRow=document.getElementById("paymentDueRow");
  if(dueRow)dueRow.hidden=selectedPayment==="UPI";
  const status=document.getElementById("paymentStatus");
  const partialWrap=document.getElementById("partialAdvanceWrap");
  if(partialWrap)partialWrap.hidden=selectedPayment!=="UPI Advance + COD";
  if(status){
    if(selectedPayment==="COD"){
      status.textContent="COD selected. ₹100 will be paid in advance via UPI as a COD handling charge. You will still pay the full product amount on delivery.";
    }else if(selectedPayment==="UPI Advance + COD"){
      status.textContent="Partial Payment selected. Pay the chosen advance via UPI now; the remaining product balance is due on delivery.";
    }else{
      status.textContent="UPI selected. The full order value will be paid via UPI.";
    }
  }
  const button=document.querySelector("#paymentModal .primary-btn.full");
  if(button){
    button.textContent=selectedPayment==="UPI"?"Pay Full Amount via UPI →":selectedPayment==="COD"?"Pay ₹100 Advance via UPI →":"Pay Advance via UPI →";
  }
}

function selectPayment(method,el){
  selectedPayment=method;
  document.querySelectorAll(".payment-method").forEach(x=>x.classList.remove("active"));
  el.classList.add("active");
  renderPayment();
}

async function invokePaymentFunction(functionName,body){
  const {data,error}=await supabaseClient.functions.invoke(functionName,{body});
  if(error){
    let message=error.message||"Payment service request failed.";
    try{
      if(error.context&&typeof error.context.json==="function"){
        const payload=await error.context.json();
        message=payload?.error||payload?.message||message;
      }
    }catch(_){}
    throw new Error(message);
  }
  if(data?.error)throw new Error(data.error);
  if(!data)throw new Error("Payment service returned an empty response.");
  return data;
}

function resetPaymentButton(button){
  if(button){button.disabled=false;button.textContent=selectedPayment==="UPI"?"Pay Full Amount via UPI →":selectedPayment==="COD"?"Pay ₹100 Advance via UPI →":"Pay Advance via UPI →";}
}

async function continuePayment(){
  if(!pendingCheckout||!cart.length){alert("Your cart is empty.");return;}
  if(typeof window.Razorpay!=="function"){
    alert("Razorpay Checkout could not load. Please refresh the page and try again.");
    return;
  }
  const breakdown=paymentBreakdown();
  if(selectedPayment==="UPI Advance + COD"&&breakdown.upfront>=breakdown.subtotal){
    alert("For Partial Payment, the UPI advance must be less than the order value.");
    return;
  }
  const button=document.querySelector("#paymentModal .primary-btn.full");
  if(button){button.disabled=true;button.textContent="Creating secure payment…";}
  const items=cart.map(item=>({product_id:item.id,size:item.size,quantity:item.qty||1}));
  let verificationStarted=false;
  let paymentFailed=false;
  let orderSaved=false;
  try{
    const created=await invokePaymentFunction("create-payment-order",{
      mode:selectedPayment,
      partial_advance:breakdown.upfront,
      items
    });
    if(!created.key_id||!created.razorpay_order_id||!created.amount_paise){
      throw new Error("Razorpay did not return the required order details.");
    }

    const options={
      key:created.key_id,
      amount:created.amount_paise,
      currency:created.currency||"INR",
      name:"GenZ Men's",
      description:selectedPayment==="UPI"?"Full payment":selectedPayment==="COD"?"COD - ₹100 advance":"Partial UPI advance",
      order_id:created.razorpay_order_id,
      prefill:{
        name:pendingCheckout.customer_name,
        email:pendingCheckout.customer_email,
        contact:pendingCheckout.customer_phone,
        method:"upi"
      },
      notes:{payment_mode:selectedPayment},
      theme:{color:"#1264e8",hide_topbar:true},
      modal:{
        ondismiss:function(){
          if(!verificationStarted&&!paymentFailed&&!orderSaved){
            resetPaymentButton(button);
            const status=document.getElementById("paymentStatus");
            if(status)status.textContent="Payment window closed. No order was created.";
          }
        }
      },
      handler:async function(response){
        verificationStarted=true;
        if(button){button.disabled=true;button.textContent="Verifying payment…";}
        try{
          const verified=await invokePaymentFunction("verify-and-create-order",{
            mode:selectedPayment,
            partial_advance:breakdown.upfront,
            items,
            razorpay_order_id:response.razorpay_order_id,
            razorpay_payment_id:response.razorpay_payment_id,
            razorpay_signature:response.razorpay_signature,
            checkout:pendingCheckout
          });
          if(!verified.order_number)throw new Error("Payment was received but the order confirmation number was not returned.");
          orderSaved=true;
          cart=[];
          saveCart();
          pendingCheckout=null;
          closePayment();
          renderCart();
          const paidNow=Number(verified.upfront_amount??created.upfront_amount??breakdown.upfront);
          const due=Number(verified.amount_due??created.amount_due??breakdown.due);
          const total=Number(verified.total??created.total??breakdown.total);
          alert("Payment verified and order confirmed!\nOrder Number: "+verified.order_number+"\nPaid via UPI: ₹"+paidNow.toLocaleString("en-IN")+"\nAmount due on delivery: ₹"+due.toLocaleString("en-IN")+"\nOrder value: ₹"+total.toLocaleString("en-IN"));
        }catch(error){
          console.error("Payment verification/order creation failed:",error);
          const detail=error?.message||"Unknown verification error";
          alert("Razorpay returned a payment response, but we could not confirm the order. Do not pay again yet.\nPayment ID: "+(response.razorpay_payment_id||"not returned")+"\nReason: "+detail+"\nPlease contact customer support with this Payment ID.");
          const status=document.getElementById("paymentStatus");
          if(status)status.textContent="Payment verification needs attention. Please do not repeat payment until the status is checked.";
        }finally{
          resetPaymentButton(button);
        }
      }
    };

    const checkout=new window.Razorpay(options);
    checkout.on("payment.failed",function(response){
      paymentFailed=true;
      const detail=response?.error?.description||response?.error?.reason||"Please try again.";
      console.error("Razorpay payment failed:",response?.error||response);
      alert("Payment failed: "+detail);
      const status=document.getElementById("paymentStatus");
      if(status)status.textContent="Payment failed. You can try again.";
      resetPaymentButton(button);
    });
    if(button){button.disabled=true;button.textContent="Opening secure checkout…";}
    checkout.open();
  }catch(error){
    console.error("Razorpay checkout initialization failed:",error);
    alert("Could not start Razorpay checkout.\n\nReason: "+(error?.message||"Unknown error"));
    resetPaymentButton(button);
  }
}

function closePayment(){
  document.getElementById("paymentModal").classList.remove("show");
}


const SUPABASE_URL="https://sxjswfvfwmibiumyrceb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_678HrTraImMobymHWNLq0Q_iSSqhh4O";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

async function loadStoreProducts(){
  try{
    const r=await supabaseClient.from("products").select("id,name,slug,description,price,compare_at_price,badge,sizes,category_id,is_active").eq("is_active",true).order("created_at",{ascending:false});
    if(r.error)throw r.error;
    if(!r.data?.length)return;
    const ids=r.data.map(p=>p.id);
    const [cr,ir,sr]=await Promise.all([
      supabaseClient.from("categories").select("id,name"),
      supabaseClient.from("product_images").select("product_id,image_url,sort_order,is_primary").in("product_id",ids).order("sort_order"),
      supabaseClient.from("inventory").select("product_id,size,stock_qty").in("product_id",ids)
    ]);
    if(cr.error)throw cr.error;
    const cm={},im={},sm={};
    (cr.data||[]).forEach(x=>cm[x.id]=x.name);
    (ir.data||[]).forEach(x=>(im[x.product_id]??=[]).push(x.image_url));
    (sr.data||[]).forEach(x=>{(sm[x.product_id]??={})[x.size]=Number(x.stock_qty||0);});
    products=r.data.map(p=>({id:p.id,name:p.name,category:cm[p.category_id]||"Uncategorized",price:Number(p.price||0),compare_at_price:p.compare_at_price,badge:p.badge||"",description:p.description||"",sizes:p.sizes||["S","M","L","XL","XXL"],images:im[p.id]||[],inventory:sm[p.id]||{}}));
    cart=cart.filter(item=>products.some(p=>String(p.id)===String(item.id)));
    saveCart();
    renderProducts();
    console.log("Live catalog loaded:",products.length);
  }catch(e){console.error("Live catalog load failed:",e);}
}

function img(p,v){
  v=v||1;
  if(p?.images?.length)return p.images[(v-1)%p.images.length]||p.images[0];
  return typeof p?.id==="number"?"Images/Product"+String(p.id).padStart(2,"0")+"/view"+v+".jpg":"";
}

function renderProducts(){
  const q=document.getElementById("search").value.toLowerCase();
  const list=products.filter(p=>
    (category==="All"||p.category===category) &&
    p.name.toLowerCase().includes(q)
  );
  document.getElementById("products").innerHTML=list.map(p=>{
    const id=String(p.id);
    const old=p.compare_at_price && Number(p.compare_at_price)>Number(p.price)
      ? `<span class="old">₹${Number(p.compare_at_price).toLocaleString("en-IN")}</span>` : "";
    return `
      <article class="card">
        <div class="card-img" onclick='openProduct(${JSON.stringify(id)})'>
          ${p.badge ? `<span class="badge">${p.badge}</span>` : ""}
          <img src="${img(p,1)}" alt="${p.name}" onerror="this.style.display='none'">
        </div>
        <div class="card-body">
          <div class="category">${p.category}</div>
          <h3>${p.name}</h3>
          <div class="price">₹${Number(p.price).toLocaleString("en-IN")}${old}</div>
          <button class="add" onclick='openProduct(${JSON.stringify(id)})'>View Product</button>
        </div>
      </article>`;
  }).join("");
}

function openProduct(id){
  current=products.find(p=>String(p.id)===String(id));
  if(!current)return;
  const sizes=current.sizes||["S","M","L","XL","XXL"];
  selectedSize=sizes.includes("M")?"M":sizes[0];
  currentView=1;
  document.getElementById("modalCategory").textContent=current.category;
  document.getElementById("modalName").textContent=current.name;
  const old=current.compare_at_price&&Number(current.compare_at_price)>Number(current.price)?" <span class=\"old\">₹"+Number(current.compare_at_price).toLocaleString("en-IN")+"</span>":"";
  document.getElementById("modalPrice").innerHTML="₹"+Number(current.price).toLocaleString("en-IN")+old;
  const list=current.images?.length?current.images:[1,2,3,4,5].map(v=>img(current,v));
  document.getElementById("mainImage").src=list[0];
  document.getElementById("thumbs").innerHTML=list.slice(0,5).map((url,i)=>"<img class=\""+(i===0?"active":"")+"\" src=\""+url+"\" alt=\"View "+(i+1)+"\" onclick=\"showView("+(i+1)+")\" onerror=\"this.style.display=\\\x27none\\\x27\">").join("");
  document.querySelectorAll("#sizes button").forEach(b=>{const size=b.textContent;b.style.display=sizes.includes(size)?"":"none";b.classList.toggle("selected",size===selectedSize);b.disabled=sizes.includes(size)&&Number(current.inventory?.[size]??0)<=0;b.onclick=()=>{if(b.disabled)return;selectedSize=size;document.querySelectorAll("#sizes button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");updateAddButtonState();};});
  updateAddButtonState();setupSlider();document.getElementById("productModal").classList.add("show");
}
function updateAddButtonState(){const b=document.querySelector("#productModal .primary-btn.full");if(!b||!current)return;const known=Object.keys(current.inventory||{}).length>0;const stock=Number(current.inventory?.[selectedSize]??0);b.textContent=known&&stock<=0?"Out of Stock":"Add to Cart";b.disabled=known&&stock<=0;}
function showView(v){if(!current)return;const count=current.images?.length||5;if(v>count)v=1;if(v<1)v=count;currentView=v;document.getElementById("mainImage").src=img(current,currentView);document.querySelectorAll(".thumbs img").forEach((x,i)=>x.classList.toggle("active",i+1===currentView));}
function addCurrentToCart(){if(!current)return;const known=Object.keys(current.inventory||{}).length>0;const available=Number(current.inventory?.[selectedSize]??0);if(known&&available<=0){alert("This size is currently out of stock.");return;}const existing=cart.find(item=>String(item.id)===String(current.id)&&item.size===selectedSize);if(existing)existing.qty=Math.min(known?Math.min(9,available):9,(existing.qty||1)+1);else cart.push({id:current.id,size:selectedSize,qty:1});saveCart();closeProduct();openCart();}

loadStoreProducts();
document.addEventListener("click",function(e){
  const el=e.target.closest(".product-open");
  if(!el)return;
  e.preventDefault();
  e.stopPropagation();
  const id=el.getAttribute("data-product-id");
  if(typeof openProduct==="function") openProduct(id);
},true);
