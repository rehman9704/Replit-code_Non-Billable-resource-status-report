-- Create dedicated table for chat comments with intended employee mapping
-- This allows comments to be preserved for specific employees even when they don't exist in reports

CREATE TABLE IF NOT EXISTS chat_comments_intended (
    id SERIAL PRIMARY KEY,
    intended_zoho_id TEXT NOT NULL,
    intended_employee_name TEXT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_visible BOOLEAN DEFAULT FALSE,
    actual_employee_id INTEGER REFERENCES employees(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert all chat comments with their intended employee mappings
INSERT INTO chat_comments_intended (intended_zoho_id, intended_employee_name, sender, content, timestamp, is_visible, actual_employee_id)
VALUES
-- Comments for existing employees (visible)
('10012260', 'Praveen M G', 'Kishore Kumar Thirupuraanandan', 'Currently partially billable on the Petbarn project and undergoing training in Shopify', '2025-06-25 19:39:31', TRUE, (SELECT id FROM employees WHERE zoho_id = '10012260')),
('10013228', 'Laxmi Pavani', 'Kishore Kumar Thirupuraanandan', 'She will non billable for initial 3 months - Expecting billable from September', '2025-07-02 19:56:30', TRUE, (SELECT id FROM employees WHERE zoho_id = '10013228')),
('10012233', 'Mohammad Bilal G', 'Kishore Kumar Thirupuraanandan', 'There is no active opportunity at the moment. Mahaveer intends to provide him  in Optimizely', '2025-06-25 19:42:31', TRUE, (SELECT id FROM employees WHERE zoho_id = '10012233')),
('10012796', 'Prabhjas Singh Bajwa', 'Kishore Kumar Thirupuraanandan', 'There is no active opportunity at the moment. Mahaveer intends to provide him with AI training - GWA Use case', '2025-06-25 19:44:15', TRUE, (SELECT id FROM employees WHERE zoho_id = '10012796')),
('10114291', 'Jatin Udasi', 'Kishore Kumar Thirupuraanandan', 'There is no active opportunity at the moment. Mahaveer intends to provide him with AI training - GWA Use case', '2025-06-25 19:41:43', TRUE, (SELECT id FROM employees WHERE zoho_id = '10114291')),
('10000391', 'Prashanth Janardhanan', 'Kishore Kumar Thirupuraanandan', 'Billable under  JE Dune , Richarson', '2025-07-02 19:55:17', TRUE, (SELECT id FROM employees WHERE zoho_id = '10000391')),

-- Comments for employees not in current reports (hidden until employee is added)
('10012956', 'Monika Pal', 'Kishore Kumar Thirupuraanandan', '50% Billable in Whilecap . Aslo PM for - Rockwest, UFA', '2025-07-03 13:23:03', FALSE, NULL),
('10013105', 'Syamala Haritha Kolisetty', 'Kishore Kumar Thirupuraanandan', 'Managing - Work Wear, Gallagher, Pet Barn', '2025-07-02 20:17:44', FALSE, NULL),
('10013230', 'Riya Saha', 'Kishore Kumar Thirupuraanandan', 'Managing - PlaceMaker & Pet Barn ( AREN) - Cost covered in the Margin', '2025-07-03 13:24:11', FALSE, NULL),
('10013366', 'Nitin Jyotishi', 'Kishore Kumar Thirupuraanandan', 'Managing - Barns and Noble, CEGB, JSW -  Will be billable 100% in MOS from JULY', '2025-07-03 13:24:52', FALSE, NULL),
('10013668', 'Bushra Jahangir', 'Kishore Kumar Thirupuraanandan', 'Managing - Mena bev, JBS - Like a account manager for Pakistan base- Covered under Mena bev', '2025-07-03 13:25:26', FALSE, NULL),
('10013776', 'Khizar Touqeer', 'Kishore Kumar Thirupuraanandan', 'Managing - Arcelik, Dollance , Arceli Hitachi - Cost Covered in the Margin', '2025-07-03 13:26:09', FALSE, NULL),
('10114434', 'Muhammad Aashir', 'Kishore Kumar Thirupuraanandan', 'PM for Y design & True religion, From Aug Bellacor - 50 % billable - SOW is under preparation', '2025-06-25 20:02:51', FALSE, NULL),
('10011067', 'Bashir Uddin', 'Kishore Kumar Thirupuraanandan', 'He is working in maintance - From 3rd July he will be billable', '2025-07-02 20:27:11', FALSE, NULL),
('10012021', 'Nova J', 'Kishore Kumar Thirupuraanandan', 'Placemaker Buffer - Will be 100% billable from Mid July', '2025-07-03 13:28:51', FALSE, NULL),
('10012577', 'Shruti Agarwal', 'Kishore Kumar Thirupuraanandan', 'Training on SAP S4 Hana -  Back up  Bench - Less cost', '2025-06-25 20:06:23', FALSE, NULL),
('10012580', 'Masood Tariq', 'Kishore Kumar Thirupuraanandan', 'Training on SAP S4 Hana -  Back up  Bench - Less cost', '2025-07-03 13:31:46', FALSE, NULL),
('10010506', 'Ashish Garg', 'Kishore Kumar Thirupuraanandan', 'Keico (projection) -  (two and half month''s bench)', '2025-06-25 20:07:33', FALSE, NULL),
('10010603', 'Hemant Kumar Gabra', 'Kishore Kumar Thirupuraanandan', 'one and only React bench resource. (Plan for Training)', '2025-06-30 17:54:43', FALSE, NULL),
('10010824', 'Muhammad Awais', 'Kishore Kumar Thirupuraanandan', 'JE Dunn Maintenance & Support - Bench from 10th June', '2025-07-02 20:39:36', FALSE, NULL),
('10011131', 'Saad Jamil Sandhu', 'Kishore Kumar Thirupuraanandan', 'Dimond Roofing + KO Requirements Phase 1.Fletcher Builder - From 16th June on bench', '2025-07-02 20:40:00', FALSE, NULL),
('10011980', 'Farrukh Khan', 'Kishore Kumar Thirupuraanandan', '8/10 Skill set -  good feedback', '2025-07-02 20:51:20', FALSE, NULL),
('10012529', 'Ghazala Bibi', 'Kishore Kumar Thirupuraanandan', 'RAC - ACIMA Extended Aisle - Bench from 1st June', '2025-06-25 20:09:21', FALSE, NULL),
('10012856', 'Abilash Cherian', 'Kishore Kumar Thirupuraanandan', 'Will be released from RAC by End of June.', '2025-06-25 20:10:45', FALSE, NULL),
('10012238', 'Muhammad Usman', 'Kishore Kumar Thirupuraanandan', 'Shadow resource as per the SOW - Agreed and approved by Finance', '2025-07-03 12:31:52', FALSE, NULL);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_chat_comments_intended_zoho_id ON chat_comments_intended(intended_zoho_id);
CREATE INDEX IF NOT EXISTS idx_chat_comments_intended_visible ON chat_comments_intended(is_visible);
CREATE INDEX IF NOT EXISTS idx_chat_comments_intended_employee_id ON chat_comments_intended(actual_employee_id);

-- Function to auto-update visibility when employees are added to reports
CREATE OR REPLACE FUNCTION update_chat_visibility() RETURNS TRIGGER AS $$
BEGIN
    -- When a new employee is added or zoho_id is updated, check for pending comments
    UPDATE chat_comments_intended 
    SET is_visible = TRUE, actual_employee_id = NEW.id
    WHERE intended_zoho_id = NEW.zoho_id AND is_visible = FALSE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically show comments when employee is added
DROP TRIGGER IF EXISTS trigger_update_chat_visibility ON employees;
CREATE TRIGGER trigger_update_chat_visibility
    AFTER INSERT OR UPDATE OF zoho_id ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_visibility();