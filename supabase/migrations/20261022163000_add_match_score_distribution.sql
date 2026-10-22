-- 仅向匹配双方暴露匿名聚合数据，避免前端直接读取其他人的匹配记录。
-- 样本少于 30 对时不返回分桶，前端会明确回退为算法模拟参考。
CREATE OR REPLACE FUNCTION public.get_match_score_distribution(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_week_tag TEXT;
  v_score DOUBLE PRECISION;
  v_sample_size INTEGER;
  v_mean DOUBLE PRECISION;
  v_standard_deviation DOUBLE PRECISION;
  v_percentile DOUBLE PRECISION;
  v_bins JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT week_tag, match_rate
    INTO v_week_tag, v_score
  FROM public.matches
  WHERE id = p_match_id
    AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
    AND match_rate IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found or access denied';
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    AVG(match_rate)::DOUBLE PRECISION,
    COALESCE(STDDEV_POP(match_rate), 0)::DOUBLE PRECISION
  INTO v_sample_size, v_mean, v_standard_deviation
  FROM public.matches
  WHERE week_tag = v_week_tag
    AND match_rate IS NOT NULL
    AND status IN ('pending', 'matched');

  IF v_sample_size < 30 THEN
    RETURN jsonb_build_object(
      'source', 'insufficient',
      'sample_size', v_sample_size,
      'week_tag', v_week_tag
    );
  END IF;

  -- 使用 mid-rank 处理同分组合，避免最高分或大量并列分被误报为绝对 100%。
  SELECT ROUND((
    100.0 * (
      COUNT(*) FILTER (WHERE match_rate < v_score)
      + 0.5 * COUNT(*) FILTER (WHERE match_rate = v_score)
    ) / v_sample_size
  )::NUMERIC, 1)::DOUBLE PRECISION
  INTO v_percentile
  FROM public.matches
  WHERE week_tag = v_week_tag
    AND match_rate IS NOT NULL
    AND status IN ('pending', 'matched');

  WITH bucket_counts AS (
    SELECT
      LEAST(FLOOR(match_rate / 5)::INTEGER, 19) AS bucket,
      COUNT(*)::INTEGER AS count
    FROM public.matches
    WHERE week_tag = v_week_tag
      AND match_rate IS NOT NULL
      AND status IN ('pending', 'matched')
    GROUP BY 1
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'min', series.bucket * 5,
      'max', (series.bucket + 1) * 5,
      'count', COALESCE(bucket_counts.count, 0)
    )
    ORDER BY series.bucket
  )
  INTO v_bins
  FROM generate_series(0, 19) AS series(bucket)
  LEFT JOIN bucket_counts USING (bucket);

  RETURN jsonb_build_object(
    'source', 'empirical',
    'sample_size', v_sample_size,
    'week_tag', v_week_tag,
    'mean', ROUND(v_mean::NUMERIC, 2),
    'standard_deviation', ROUND(v_standard_deviation::NUMERIC, 2),
    'percentile', v_percentile,
    'bins', v_bins
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_match_score_distribution(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_match_score_distribution(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_match_score_distribution(UUID) IS
  'Returns a 20-bin anonymous score distribution for the caller''s match week when at least 30 pairs exist.';
