-- Sexe : Femme, Homme, Je ne précise pas, ou vide.
-- A lancer dans le SQL Editor si le projet existe déjà.
-- Les lignes déjà enregistrées ne sont ni effacées ni modifiées.
-- S'il reste une ancienne valeur, la contrainte n'est pas posée :
-- sinon une mise à jour (garder, rejeter) échouerait sur ces lignes.
-- L'application refuse déjà cette valeur à l'envoi.

do $$
begin
  if not exists (
    select 1
    from public.recordings
    where gender not in ('', 'femme', 'homme', 'non_dit')
  ) then
    alter table public.recordings drop constraint if exists recordings_gender_check;
    alter table public.recordings
      add constraint recordings_gender_check
      check (gender in ('', 'femme', 'homme', 'non_dit'));
  end if;
end $$;
