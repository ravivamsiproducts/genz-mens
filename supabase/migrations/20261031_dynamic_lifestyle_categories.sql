-- GenZ Men's: dynamic lifestyle categories and product types.
-- Apparel categories require clothing sizes; general products use One Size.
alter table public.categories
  add column if not exists category_type text not null default 'general';

alter table public.categories
  drop constraint if exists categories_category_type_check;
alter table public.categories
  add constraint categories_category_type_check
  check (category_type in ('apparel','general'));

update public.categories
set category_type='apparel'
where lower(slug) in ('shirts','t-shirts','kurtas','bottomwear');

insert into public.categories (name,slug,category_type,is_active)
values
  ('Footwear','footwear','general',true),
  ('Accessories','accessories','general',true),
  ('Men''s Grooming','mens-grooming','general',true),
  ('Perfumes & Fragrances','perfumes-fragrances','general',true),
  ('Hair Care','hair-care','general',true),
  ('Skin Care','skin-care','general',true),
  ('Gift Sets','gift-sets','general',true)
on conflict (slug) do update
set category_type=excluded.category_type;
