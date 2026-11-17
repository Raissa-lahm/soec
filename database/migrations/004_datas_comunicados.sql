-- Datas dos comunicados exibidas na agenda institucional.
ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS data_evento DATE;
ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS prazo_final DATE;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_comunicados_prazo_final') THEN
        ALTER TABLE comunicados ADD CONSTRAINT ck_comunicados_prazo_final
            CHECK (data_evento IS NULL OR prazo_final IS NULL OR prazo_final >= data_evento);
    END IF;
END $$;
