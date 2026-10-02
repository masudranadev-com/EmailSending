ALTER TABLE campaign
  ADD KEY campaign_created_id_index (created_at, id),
  ADD KEY campaign_updated_id_index (updated_at, id),
  ADD KEY campaign_schedule_id_index (schedule_date, id);
