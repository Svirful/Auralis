import React, { useState, useEffect } from 'react';
import './skills-settings.scss';
import cn from 'classnames';

type Skill = {
    id: string;
    name: string;
    description: string;
    instructions: string;
    path: string;
};

export default function SkillsSettings() {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [selectedSkill, setSelectedSkill] = useState<Skill | 'new' | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Form state
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newInstr, setNewInstr] = useState('');
    const [saveStatus, setSaveStatus] = useState<{success: boolean, message: string} | null>(null);

    const loadSkills = async () => {
        try {
            const list = await window.electron.skills.getAll();
            setSkills(list);
            
            // If we just saved "new", try to find it in the list and select it
            if (saveStatus?.success && selectedSkill === 'new') {
                 const justSaved = list.find((s: Skill) => s.name === newName);
                 if (justSaved) setSelectedSkill(justSaved);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadSkills();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSave = async () => {
        setLoading(true);
        setSaveStatus(null);
        try {
            const res = await window.electron.skills.save({
                name: newName,
                description: newDesc,
                instructions: newInstr
            });
            if (res.success) {
                setSaveStatus({ success: true, message: 'Skill saved successfully!' });
                loadSkills();
            } else {
                setSaveStatus({ success: false, message: res.error || 'Failed to save' });
            }
        } catch (e: any) {
            setSaveStatus({ success: false, message: e.message });
        }
        setLoading(false);
    };

    return (
        <div className="skills-settings">
            <div className="skills-sidebar">
                <h3>Skills</h3>
                <ul>
                    {skills.map(s => (
                        <li 
                            key={s.id} 
                            className={cn({ active: selectedSkill !== 'new' && (selectedSkill as Skill)?.id === s.id })}
                            onClick={() => { setSelectedSkill(s); setSaveStatus(null); }}
                        >
                            <span className="skill-name">{s.name}</span>
                        </li>
                    ))}
                </ul>
                <div className="add-skill-section">
                    <button 
                        className="action-button"
                        onClick={() => {
                            setSelectedSkill('new');
                            setNewName('');
                            setNewDesc('');
                            setNewInstr('');
                            setSaveStatus(null);
                        }}
                    >
                         + Add New Skill
                    </button>
                </div>
            </div>
            
            <div className="skills-content">
                {selectedSkill === 'new' ? (
                    <div className="create-skill-form">
                        <div className="server-header">
                            <h3>Create New Skill</h3>
                        </div>
                        <div className="form-group">
                            <label>Skill Name</label>
                            <input 
                                value={newName} 
                                onChange={e => setNewName(e.target.value)} 
                                placeholder="e.g. code-review"
                            />
                        </div>
                        <div className="form-group">
                            <label>Description (Short)</label>
                            <textarea 
                                value={newDesc} 
                                onChange={e => setNewDesc(e.target.value)}
                                placeholder="What does this skill do? (Used by Agent to decide when to use)"
                                rows={2}
                            />
                        </div>
                        <div className="form-group">
                            <label>Instructions (SKILL.md content)</label>
                            <textarea 
                                value={newInstr} 
                                onChange={e => setNewInstr(e.target.value)}
                                placeholder="Write the detailed instructions for the agent here..."
                                className="code-editor"
                                rows={15}
                            />
                        </div>
                        
                        {saveStatus && (
                             <div className={cn("status-msg", { success: saveStatus.success, error: !saveStatus.success })}>
                                {saveStatus.message}
                             </div>
                        )}

                        <div className="form-actions">
                             <button className="action-button save" onClick={handleSave} disabled={loading || !newName}>
                                {loading ? 'Saving...' : 'Save Skill'}
                             </button>
                        </div>
                    </div>
                ) : selectedSkill ? (
                    <div className="skill-details">
                         <div className="server-header">
                            <h3>{selectedSkill.name}</h3>
                            <button className="delete-btn" onClick={async () => {
                                if(window.confirm(`Delete skill "${selectedSkill.name}"?`)) {
                                    await window.electron.skills.delete(selectedSkill.id);
                                    setSelectedSkill(null);
                                    loadSkills();
                                }
                            }}>Delete</button>
                        </div>
                        
                        <div className="status-msg success" style={{display: 'inline-block', marginBottom: '1rem', fontSize: '0.8rem'}}>
                             Location: {selectedSkill.path}
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem', borderRadius: '16px', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: 1.6}}>
                                {selectedSkill.description}
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Instructions</label>
                            <div style={{background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '16px', overflowX: 'auto'}}>
                                <pre style={{margin: 0, fontSize: '0.85rem', color: '#7eb6ff', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap'}}>
                                    {selectedSkill.instructions}
                                </pre>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="no-selection">
                        <p>Select a skill to view details or create a new one.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
