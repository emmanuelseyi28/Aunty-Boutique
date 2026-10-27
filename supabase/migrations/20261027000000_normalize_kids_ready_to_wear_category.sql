-- Merge common spelling and punctuation variations into one Kids' Ready-to-Wear category.
update public.products
set category = 'Kids'' Ready-to-Wear',
    updated_at = now()
where regexp_replace(
  lower(replace(replace(trim(category), '’', ''''), '‘', '''')),
  '[-_[:space:]]+',
  ' ',
  'g'
) in (
  'kids ready to wear',
  'kids'' ready to wear',
  'kid ready to wear',
  'kid''s ready to wear',
  'children ready to wear',
  'children''s ready to wear'
);
