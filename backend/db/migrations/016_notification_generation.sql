-- US08 writes history in the same statement as the actual status/decision.
-- Generate its notification here so all three changes succeed or fail together.
CREATE FUNCTION notify_opportunity_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  recipient uuid;
  opportunity_title text;
  notification_kind text;
  description text;
BEGIN
  IF NEW.source <> 'live'
     OR NEW.event_type NOT IN ('status_changed', 'decision_recorded', 'delivery_status_changed')
     OR NEW.from_status IS NOT DISTINCT FROM NEW.to_status THEN
    RETURN NEW;
  END IF;

  notification_kind := CASE NEW.to_status
    WHEN 'in_assessment' THEN 'under_review'
    WHEN 'approved' THEN 'approved'
    WHEN 'rejected' THEN 'rejected'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'testing' THEN 'testing'
    WHEN 'completed' THEN 'project_completed'
  END;
  IF notification_kind IS NULL THEN RETURN NEW; END IF;

  SELECT submitted_by, title INTO recipient, opportunity_title
  FROM opportunities WHERE id = NEW.opportunity_id;
  IF recipient IS NULL OR recipient = NEW.actor_id THEN RETURN NEW; END IF;

  description := CASE notification_kind
    WHEN 'under_review' THEN 'is now Under Review.'
    WHEN 'approved' THEN CASE WHEN NEW.event_type = 'decision_recorded'
      THEN 'was approved.' ELSE 'is now Approved.' END
    WHEN 'rejected' THEN 'was rejected.'
    WHEN 'in_progress' THEN 'is now In Progress.'
    WHEN 'testing' THEN 'is now Testing.'
    WHEN 'project_completed' THEN 'is now Completed.'
  END;

  INSERT INTO notifications (user_id, opportunity_id, kind, message, created_at, history_event_id)
  VALUES (recipient, NEW.opportunity_id, notification_kind,
          format('Your opportunity “%s” %s', opportunity_title, description), NEW.occurred_at, NEW.id)
  ON CONFLICT (history_event_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER opportunity_history_notification
AFTER INSERT ON opportunity_history
FOR EACH ROW EXECUTE FUNCTION notify_opportunity_history();
