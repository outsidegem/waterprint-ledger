(function() {
    'use strict';

    // 1. Diagnostic Telemetry Logger
    const ActionLogger = {
        logs: [],
        log: function(action, details = {}) {
            const entry = {
                time: new Date().toISOString().split('T')[1].slice(0, -1),
                action: action,
                details: details
            };
            this.logs.push(entry);
            if (this.logs.length > 50) this.logs.shift(); // Keep last 50 events
            console.log(`[WaterPrint Telemetry] ${action}`, details);
        },
        dump: function() {
            return JSON.stringify(this.logs, null, 2);
        }
    };

    // 2. Core Methodology (2025 Baselines)
    const Estimator = {
        methodologies: {
            'chatgpt': { energyBase: 0.34, waterBase: 0.32 },
            'gemini': { energyBase: 0.24, waterBase: 0.26 }
        },
        calculate: function(provider, charCount) {
            const params = this.methodologies[provider] || this.methodologies['chatgpt'];
            const tokenEst = Math.max(1, Math.ceil(charCount / 4));
            const workloadMultiplier = 1 + (tokenEst / 100) * 0.15;
            return {
                tokens: tokenEst,
                energyWh: params.energyBase * workloadMultiplier,
                waterMl: params.waterBase * workloadMultiplier
            };
        },
        optimize: function(rawText) {
            let clean = rawText
                .replace(/\b(As an AI( language model)?|Certainly!?|I'?d be happy to help|Sure thing!?|Here is the( information)?)\b/gi, '')
                .replace(/\b(please\s+(can\s+you\s+)?(kindly\s+)?|can\s+you\s+(please\s+)?|i\s+want\s+you\s+to\s+know\s+that|you\s+see\s+what\s+i\s+mean\??)\b/gi, '')
                .replace(/\b(it is (important|crucial) to note that|as a matter of fact|at the end of the day|due to the fact that|needless to say|for the purpose of|in order to)\b/gi, '')
                .replace(/\b(very|really|basically|essentially|literally|totally|definitely|actually|just|simply)\b/gi, '')
                .replace(/([.?!])\1+/g, '$1')
                .replace(/\s{2,}/g, ' ')
                .trim();
            return clean.length > 5 ? clean : rawText;
        }
    };

    const V_time = () => Math.floor((performance.timeOrigin + performance.now()) / 1000);

    // 3. Persistent Local Ledger
    const Ledger = {
        totalUsedWh: 0.0,
        totalUsedMl: 0.0,
        totalSavedMWh: 0,
        totalSavedUml: 0,
        load: function() {
            try {
                const saved = localStorage.getItem('waterprint_odometer');
                if (saved) {
                    const data = JSON.parse(saved);
                    this.totalUsedWh = data.usedWh || 0;
                    this.totalUsedMl = data.usedMl || 0;
                    this.totalSavedMWh = data.savedMWh || 0;
                    this.totalSavedUml = data.savedUml || 0;
                }
                ActionLogger.log('LEDGER_LOADED', { wh: this.totalUsedWh, ml: this.totalUsedMl });
            } catch (e) {
                ActionLogger.log('LEDGER_LOAD_ERROR', { error: e.toString() });
            }
        },
        save: function() {
            localStorage.setItem('waterprint_odometer', JSON.stringify({
                usedWh: this.totalUsedWh,
                usedMl: this.totalUsedMl,
                savedMWh: this.totalSavedMWh,
                savedUml: this.totalSavedUml
            }));
        },
        addUsage: function(wh, ml) {
            this.totalUsedWh += parseFloat(wh);
            this.totalUsedMl += parseFloat(ml);
            this.save();
            ActionLogger.log('ODOMETER_INCREMENT', { addedWh: wh, newTotalWh: this.totalUsedWh });
        },
        addSavings: function(mwh, uml) {
            this.totalSavedMWh += mwh;
            this.totalSavedUml += uml;
            this.save();
            ActionLogger.log('SAVINGS_RECORDED', { addedMWh: mwh, totalSavedMWh: this.totalSavedMWh });
        }
    };

    async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // 4. UI, Drag Logic & Safe Modals
    const UI = {
        hud: null,
        infoModal: null,
        attestModal: null,
        reviewModal: null,
        provider: 'chatgpt',
        currentDraftEnergy: 0.0,
        currentDraftWater: 0.0,
        
        pendingOptimizedText: "",
        pendingSavedMWh: 0,
        pendingSavedUml: 0,

        dragParams: { active: false, initialX: 0, initialY: 0, xOffset: 0, yOffset: 0 },

        inject: function(provider) {
            if (document.getElementById('waterprint-hud')) return;
            this.provider = provider;
            Ledger.load();
            ActionLogger.log('UI_INJECTED', { provider });

            this.hud = document.createElement('div');
            this.hud.id = 'waterprint-hud';
            this.hud.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#161b22;color:#c9d1d9;padding:12px 16px;border-radius:12px;font-family:monospace;z-index:999999;box-shadow:0 8px 24px rgba(0,0,0,0.8);border:1px solid #30363d;user-select:none;-webkit-user-select:none;touch-action:none;transform:translate3d(0px,0px,0px);min-width:260px;';
            document.body.appendChild(this.hud);

            const modalBaseStyle = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#0d1117;color:#c9d1d9;padding:20px;border-radius:12px;border:1px solid #30363d;box-shadow:0 12px 48px rgba(0,0,0,0.9);z-index:9999999;display:none;font-family:-apple-system,sans-serif;max-height:85vh;overflow-y:auto;';

            this.reviewModal = document.createElement('div');
            this.reviewModal.className = 'wp-modal-container';
            this.reviewModal.style.cssText = modalBaseStyle + 'width:90vw;max-width:700px;';
            document.body.appendChild(this.reviewModal);

            this.infoModal = document.createElement('div');
            this.infoModal.className = 'wp-modal-container';
            this.infoModal.style.cssText = modalBaseStyle + 'width:320px;';
            this.infoModal.innerHTML = `
                <div style="font-size:16px;font-weight:bold;color:#58a6ff;margin-bottom:12px;border-bottom:1px solid #30363d;padding-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:8px;"><span>💧</span> WaterPrint Methodology</div>
                    <span class="wp-modal-close" style="cursor:pointer;color:#8b949e;font-size:18px;line-height:1;">✕</span>
                </div>
                <div style="font-size:12px;line-height:1.5;">
                    <p style="margin-bottom:10px;"><strong>IMPORTANT DISCLAIMER:</strong> WaterPrint values are workload estimates, not physical sensor measurements.</p>
                    <p style="margin-bottom:10px;"><strong>2025 Baseline Assumptions:</strong><br>OpenAI: ~0.34 Wh / ~0.32 mL<br>Google: ~0.24 Wh / ~0.26 mL</p>
                    <p style="margin-bottom:10px;color:#8b949e;">Actual resource consumption varies based on model architecture, hardware, datacenter efficiency, and location.</p>
                    <p style="margin-bottom:0;color:#8b949e;"><strong>Future Telemetry:</strong> Future versions could integrate direct telemetry measurements.</p>
                </div>
            `;
            document.body.appendChild(this.infoModal);

            this.attestModal = document.createElement('div');
            this.attestModal.className = 'wp-modal-container';
            this.attestModal.style.cssText = modalBaseStyle + 'width:340px;';
            document.body.appendChild(this.attestModal);

            this.render();
            this.initInteractions();
            this.initDispatchDetector();
        },

        render: function() {
            const liveWh = this.currentDraftEnergy.toFixed(4);
            const liveMl = this.currentDraftWater.toFixed(4);
            const totalWh = Ledger.totalUsedWh.toFixed(4);
            const totalMl = Ledger.totalUsedMl.toFixed(4);
            
            this.hud.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <span style="font-weight:bold;color:#fff;font-family:-apple-system,sans-serif;font-size:14px;">💧 WaterPrint</span>
                    <div id="wp-drag-handle" style="cursor:grab;padding:0 4px;color:#8b949e;font-size:16px;">⋮⋮</div>
                </div>
                <div style="display:grid;grid-template-columns:40px 1fr;gap:12px;font-size:12px;margin-bottom:6px;">
                    <span style="color:#8b949e;">Draft</span>
                    <span><span style="color:#58a6ff;">${liveWh} Wh</span> <span style="color:#8b949e;margin:0 4px;">·</span> <span style="color:#58a6ff;">${liveMl} mL</span></span>
                </div>
                <div style="display:grid;grid-template-columns:40px 1fr;gap:12px;font-size:12px;margin-bottom:16px;">
                    <span style="color:#8b949e;">Total</span>
                    <span><span style="color:#f85149;">${totalWh} Wh</span> <span style="color:#8b949e;margin:0 4px;">·</span> <span style="color:#f85149;">${totalMl} mL</span></span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div id="wp-btn-opt" class="wp-action-btn" style="background:#21262d;border:1px solid #30363d;color:#f0883e;padding:6px 12px;border-radius:6px;cursor:pointer;font-family:-apple-system,sans-serif;font-size:12px;font-weight:600;">⚡ Optimize</div>
                    <div id="wp-btn-attest" class="wp-action-btn" style="background:#238636;border:1px solid #2ea043;color:#fff;padding:6px 12px;border-radius:6px;cursor:pointer;font-family:-apple-system,sans-serif;font-size:12px;font-weight:600;">📜 Attest</div>
                    <div id="wp-btn-info" class="wp-action-btn" style="cursor:pointer;font-size:16px;color:#8b949e;padding:0 4px;margin-left:auto;">ⓘ</div>
                    <div id="wp-btn-debug" class="wp-action-btn" style="cursor:pointer;font-size:14px;color:#8b949e;padding:0 4px;">🐞</div>
                </div>
            `;
        },

        initInteractions: function() {
            this.hud.addEventListener('click', async (e) => {
                const target = e.target.closest('.wp-action-btn');
                if (!target) return;
                e.preventDefault(); e.stopPropagation();
                
                ActionLogger.log('HUD_BUTTON_CLICKED', { buttonId: target.id });

                if (target.id === 'wp-btn-debug') {
                    navigator.clipboard.writeText(ActionLogger.dump());
                    target.style.color = '#39d353';
                    setTimeout(() => target.style.color = '#8b949e', 1000);
                    return;
                }
                
                target.style.opacity = '0.7';
                setTimeout(() => target.style.opacity = '1', 150);

                if (target.id === 'wp-btn-opt') Adapters.runOptimization();
                else if (target.id === 'wp-btn-attest') await this.showAttestation();
                else if (target.id === 'wp-btn-info') this.showModal(this.infoModal);
            });

            document.addEventListener('click', (e) => {
                const closeBtn = e.target.closest('.wp-modal-close');
                if (closeBtn) {
                    const modal = closeBtn.closest('.wp-modal-container');
                    ActionLogger.log('MODAL_CLOSED', { modalId: modal.id });
                    modal.style.display = 'none';
                }
            });

            this.reviewModal.addEventListener('click', (e) => {
                const target = e.target.closest('.wp-rev-btn');
                if (!target) return;
                e.preventDefault(); e.stopPropagation();

                ActionLogger.log('REVIEW_MODAL_CLICKED', { buttonId: target.id });
                target.style.opacity = '0.7';
                
                if (target.id === 'wp-btn-rev-cancel') {
                    setTimeout(() => {
                        target.style.opacity = '1';
                        this.reviewModal.style.display = 'none';
                    }, 150);
                } else if (target.id === 'wp-btn-rev-accept') {
                    target.innerText = '✔ Applied!';
                    target.style.background = '#2ea043';
                    setTimeout(() => {
                        this.acceptOptimization();
                        target.style.opacity = '1';
                        target.style.background = '#238636';
                        target.innerText = '✔ Use Suggestion';
                    }, 300);
                }
            });

            const dragItem = this.hud;
            const startDrag = (e) => {
                if (e.target.id !== 'wp-drag-handle') return;
                this.dragParams.active = true;
                let clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
                let clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
                this.dragParams.initialX = clientX - this.dragParams.xOffset;
                this.dragParams.initialY = clientY - this.dragParams.yOffset;
            };
            const doDrag = (e) => {
                if (!this.dragParams.active) return;
                e.preventDefault();
                let clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
                let clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
                this.dragParams.xOffset = clientX - this.dragParams.initialX;
                this.dragParams.yOffset = clientY - this.dragParams.initialY;
                dragItem.style.transform = `translate3d(${this.dragParams.xOffset}px, ${this.dragParams.yOffset}px, 0)`;
            };
            const endDrag = () => { this.dragParams.active = false; };

            dragItem.addEventListener('touchstart', startDrag, { passive: false });
            document.addEventListener('touchmove', doDrag, { passive: false });
            document.addEventListener('touchend', endDrag);
            dragItem.addEventListener('mousedown', startDrag);
            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', endDrag);
        },

        initDispatchDetector: function() {
            const commitOdometer = () => {
                setTimeout(() => {
                    ActionLogger.log('DISPATCH_DETECTED', { draftEnergy: this.currentDraftEnergy });
                    if (this.currentDraftEnergy > 0 || this.currentDraftWater > 0) {
                        Ledger.addUsage(this.currentDraftEnergy, this.currentDraftWater);
                        this.currentDraftEnergy = 0;
                        this.currentDraftWater = 0;
                        this.render();
                    }
                }, 150);
            };
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) commitOdometer();
            }, true);
            document.addEventListener('click', (e) => {
                if (e.target.closest('button[data-testid="send-button"], button[aria-label*="Send"], button[class*="send"]')) commitOdometer();
            }, true);
        },

        showModal: function(modalElement) {
            ActionLogger.log('MODAL_OPENED');
            document.querySelectorAll('.wp-modal-container').forEach(m => m.style.display = 'none');
            modalElement.style.display = 'block';
        },

        showReview: function(baseEst, optEst, originalText, optimizedText, savedMWh, savedUml) {
            ActionLogger.log('SHOWING_OPTIMIZATION_REVIEW', { savedMWh, savedUml });
            this.pendingOptimizedText = optimizedText;
            this.pendingSavedMWh = savedMWh;
            this.pendingSavedUml = savedUml;

            this.reviewModal.innerHTML = `
                <div style="font-size:16px;font-weight:bold;color:#fff;margin-bottom:16px;border-bottom:1px solid #30363d;padding-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
                    <span>Optimization Review</span>
                    <span class="wp-modal-close" style="cursor:pointer;color:#8b949e;font-size:18px;line-height:1;">✕</span>
                </div>
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                    <div style="flex:1;min-width:240px;background:#161b22;padding:12px;border-radius:8px;border:1px solid #30363d;">
                        <div style="color:#8b949e;margin-bottom:8px;font-size:12px;font-weight:600;">Original Prompt</div>
                        <div style="font-family:monospace;font-size:11px;white-space:pre-wrap;color:#c9d1d9;margin-bottom:12px;">${originalText}</div>
                        <div style="font-size:11px;color:#58a6ff;">Estimated Energy: ${baseEst.energyWh.toFixed(4)} Wh<br>Estimated Water: ${baseEst.waterMl.toFixed(4)} mL</div>
                    </div>
                    <div style="flex:1;min-width:240px;background:#161b22;padding:12px;border-radius:8px;border:1px solid #2ea043;">
                        <div style="color:#39d353;margin-bottom:8px;font-size:12px;font-weight:600;">Optimized Prompt</div>
                        <div style="font-family:monospace;font-size:11px;white-space:pre-wrap;color:#fff;margin-bottom:12px;">${optimizedText}</div>
                        <div style="font-size:11px;color:#39d353;">Estimated Energy: ${optEst.energyWh.toFixed(4)} Wh<br>Estimated Water: ${optEst.waterMl.toFixed(4)} mL</div>
                    </div>
                </div>
                <div style="margin-top:16px;background:#1c2128;padding:12px 16px;border-radius:8px;border:1px solid #30363d;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                    <div style="font-size:12px;line-height:1.4;">
                        <strong style="color:#fff;">Savings</strong><br>
                        <span style="color:#39d353;">Energy Savings: ${savedMWh} mWh</span><br>
                        <span style="color:#39d353;">Water Savings: ${savedUml} µL</span>
                    </div>
                    <div style="display:flex;gap:10px;">
                        <div id="wp-btn-rev-cancel" class="wp-rev-btn" style="background:#21262d;border:1px solid #30363d;color:#c9d1d9;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;user-select:none;">Keep Original</div>
                        <div id="wp-btn-rev-accept" class="wp-rev-btn" style="background:#238636;border:1px solid #2ea043;color:#fff;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;user-select:none;">✔ Use Suggestion</div>
                    </div>
                </div>
            `;
            this.showModal(this.reviewModal);
        },

        acceptOptimization: function() {
            ActionLogger.log('OPTIMIZATION_ACCEPTED', { injectedTextLength: this.pendingOptimizedText.length });
            const input = Adapters.getInputElement();
            if (input) {
                if (input.tagName === 'TEXTAREA') input.value = this.pendingOptimizedText;
                else input.innerText = this.pendingOptimizedText;
                input.dispatchEvent(new Event('input', { bubbles: true })); 
            }
            Ledger.addSavings(this.pendingSavedMWh, this.pendingSavedUml);
            this.reviewModal.style.display = 'none';
        },

        showAttestation: async function() {
            ActionLogger.log('GENERATING_ATTESTATION');
            const timestamp = V_time();
            const canonicalString = `node=0x1111|mwh=${this.pendingSavedMWh}|uml=${this.pendingSavedUml}|v=1|ts=${timestamp}`;
            const hash = await sha256(canonicalString);
            
            this.attestModal.innerHTML = `
                <div style="font-weight:bold;color:#58a6ff;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                    <span>📜 Attestation Payload</span>
                    <span class="wp-modal-close" style="cursor:pointer;color:#8b949e;font-size:18px;line-height:1;">✕</span>
                </div>
                <div style="background:#161b22;padding:12px;border-radius:6px;border:1px solid #30363d;margin-bottom:12px;font-family:monospace;font-size:11px;word-break:break-all;line-height:1.5;">
                    <strong>Hash:</strong><br><span style="color:#39d353;">${hash}</span><br><br>
                    <strong>Energy Avoided:</strong> ${this.pendingSavedMWh} mWh<br>
                    <strong>Water Avoided:</strong> ${this.pendingSavedUml} µL<br>
                    <strong>Vector Time:</strong> ${timestamp}
                </div>
                <div id="wp-btn-copy" style="background:#21262d;border:1px solid #30363d;color:#c9d1d9;padding:10px;border-radius:6px;cursor:pointer;text-align:center;font-weight:bold;font-size:12px;">Copy JSON</div>
            `;
            this.showModal(this.attestModal);

            document.getElementById('wp-btn-copy').addEventListener('click', (e) => {
                ActionLogger.log('ATTESTATION_COPIED');
                e.stopPropagation();
                navigator.clipboard.writeText(JSON.stringify({
                    canonicalHash: hash,
                    energyAvoidedMWh: this.pendingSavedMWh,
                    waterAvoidedUml: this.pendingSavedUml,
                    timestamp: timestamp,
                    accountingType: "estimated_avoided"
                }, null, 2));
                e.target.innerText = '✔ Copied to Clipboard!';
                e.target.style.background = '#238636';
            });
        }
    };

    const Adapters = {
        provider: 'chatgpt',
        getInputElement: function() {
            return document.querySelector('#prompt-textarea') || document.querySelector('.ql-editor') || document.querySelector('div[contenteditable="true"]');
        },
        getRawText: function() {
            const input = this.getInputElement();
            let text = '';
            if (input) text = input.tagName === 'TEXTAREA' ? input.value : input.innerText;
            const attachments = document.querySelectorAll('[data-testid*="attachment"], .file-name, [class*="attachment"]');
            attachments.forEach(el => { text += ' ' + (el.innerText || ''); });
            return text.trim();
        },
        runOptimization: function() {
            const input = this.getInputElement();
            if (!input) {
                ActionLogger.log('OPTIMIZE_FAILED_NO_INPUT');
                return;
            }

            const rawText = input.tagName === 'TEXTAREA' ? input.value : input.innerText;
            if (!rawText || rawText.trim().length === 0) return;

            const optimizedText = Estimator.optimize(rawText);
            if (rawText === optimizedText) {
                ActionLogger.log('OPTIMIZE_SKIPPED_ALREADY_CLEAN');
                return; 
            }
            
            const baseEst = Estimator.calculate(this.provider, rawText.length);
            const optEst = Estimator.calculate(this.provider, optimizedText.length);

            const savedMWh = Math.max(0, Math.round((baseEst.energyWh - optEst.energyWh) * 1000));
            const savedUml = Math.max(0, Math.round((baseEst.waterMl - optEst.waterMl) * 1000));

            UI.showReview(baseEst, optEst, rawText, optimizedText, savedMWh, savedUml);
        },
        init: function() {
            this.provider = window.location.hostname.includes('gemini') ? 'gemini' : 'chatgpt';
            UI.inject(this.provider);

            document.addEventListener('input', () => {
                const text = this.getRawText();
                if (!text) {
                    UI.currentDraftEnergy = 0;
                    UI.currentDraftWater = 0;
                    UI.render();
                    return;
                }
                const estimate = Estimator.calculate(this.provider, text.length);
                UI.currentDraftEnergy = parseFloat(estimate.energyWh);
                UI.currentDraftWater = parseFloat(estimate.waterMl);
                UI.render();
            }, true);
        }
    };

    Adapters.init();
})();
