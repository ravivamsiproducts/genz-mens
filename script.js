const products = [
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
let cart=JSON.parse(localStorage.getItem("genzCart")||"[]");
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

  cart.push({
    id:current.id,
    size:selectedSize
  });

  saveCart();

  closeProduct();

  openCart();
}

function saveCart(){

  localStorage.setItem(
    "genzCart",
    JSON.stringify(cart)
  );

  document.getElementById("cartCount").textContent=
    cart.length;
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

  const box=
    document.getElementById("cartItems");

  let total=0;

  if(!cart.length){

    box.innerHTML=
      "<p class='muted'>Your cart is empty.</p>";

    document.getElementById("cartTotal").textContent=
      "₹0";

    return;
  }

  box.innerHTML=cart.map((item,i)=>{

    const p=
      products.find(x=>x.id===item.id);

    total+=p.price;

    return `

      <div class="cart-row">

        <img src="${img(p)}">

        <div>

          <b>${p.name}</b>

          <div class="category">
            Size: ${item.size}
          </div>

        </div>

        <strong>
          ₹${p.price.toLocaleString("en-IN")}
        </strong>

        <button
          class="remove"
          onclick="removeItem(${i})"
        >
          Remove
        </button>

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

function checkout(){

  alert(
    "Checkout UI is ready. Razorpay payment will be connected in the next phase."
  );
}

document.getElementById("cartCount").textContent=
  cart.length;

renderProducts();
