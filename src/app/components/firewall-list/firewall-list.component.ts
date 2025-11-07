import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { FirewallFilter } from 'src/app/models/firewall-filter.model';
import { FirewallLabels } from 'src/app/models/firewall-labels.model';
import { FirewallPairs } from 'src/app/models/firewall-pairs.model';
import { FirewallRule } from 'src/app/models/firewall-rule.model';
import { FirewallTarget } from 'src/app/models/firewall-target.model';
import { K8sService } from 'src/app/services/k8s.service';

@Component({
  selector: 'app-firewall-list',
  templateUrl: './firewall-list.component.html',
  styleUrls: ['./firewall-list.component.css']
})
export class FirewallListComponent implements OnInit {

    pageName: string = "Firewall";

    namespacesList: string[] = [];
    firewallRuleList: FirewallRule[] = [];
    firewallLabels: FirewallLabels = new FirewallLabels;
    myInterval = setInterval(() =>{ this.reloadComponent(); }, 120000);

    constructor(
        private cdRef: ChangeDetectorRef,
        private router: Router,
        private k8sService: K8sService
    ) { }

    async ngOnInit(): Promise<void> {
        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren(this.pageName);
        }
        await this.getNamespaces();
        await this.loadRules();
    }

    /*
     * Load Network Policies
     */
    async loadRules(): Promise<void> {
        this.firewallRuleList = [];
        try {
            const data = await lastValueFrom(this.k8sService.getNetworkPolicies());
            let policies = data.items;
            for (let i = 0; i < policies.length; i++) {
                let thisRule = new FirewallRule;
                thisRule.name = policies[i].metadata.name;
                thisRule.namespace = policies[i].metadata.namespace;
                thisRule.type = policies[i].spec.policyTypes[0].toLowerCase();
                // PROCESS TARGET
                thisRule.target = await this.processTarget(policies[i].spec.podSelector.matchLabels);
                if(thisRule.type == "ingress") {
                    thisRule.filter = await this.processIngress(policies[i].spec.ingress[0]);
                // PROCESS EGRESS
                } else if(thisRule.type == "egress") {
                    thisRule.filter = await this.processEgress(policies[i].spec.egress[0]);
                }
                this.firewallRuleList.push(thisRule);
                
            }
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Get Namespaces from Kubernetes
     */
    async getNamespaces(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getNamespaces());
            let nss = data.items;
            for (let i = 0; i < nss.length; i++) {
            this.namespacesList.push(nss[i].metadata["name"]);
            }
        } catch (e: any) {
            console.log(e);
        }
    }


    /*
     * Show New Window
     */
    async showNew(): Promise<void> {
        clearInterval(this.myInterval);
        let modalDiv = document.getElementById("modal-new");
        let modalTitle = document.getElementById("new-title");
        let selectorNamespacesField = document.getElementById("new-rule-namespace");
        let i = 0;
        if(modalTitle != null) {
            modalTitle.replaceChildren("New Firewall Rule");
        }

        /* Load Namespace List and Set Selector */
        let nsSelectorOptions = "";
        for (i = 0; i < this.namespacesList.length; i++) {
            nsSelectorOptions += "<option value=" + this.namespacesList[i] +">" + this.namespacesList[i] + "</option>\n";
        }
        if (selectorNamespacesField != null) {
            selectorNamespacesField.innerHTML = nsSelectorOptions;
        }

        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Change Rule
     */
    async changeRule(targettype: string): Promise<void> {
        let modalDiv = document.getElementById("new-rule-protocolports");
        if(targettype == "no") {
            if(modalDiv != null) {
                modalDiv.setAttribute("class", "modal fade show");
                modalDiv.setAttribute("aria-modal", "true");
                modalDiv.setAttribute("role", "dialog");
                modalDiv.setAttribute("aria-hidden", "false");
                modalDiv.setAttribute("style","display: contents;");
            }
        } else {
            if(modalDiv != null) {
                modalDiv.setAttribute("class", "modal fade");
                modalDiv.setAttribute("aria-modal", "false");
                modalDiv.setAttribute("role", "");
                modalDiv.setAttribute("aria-hidden", "true");
                modalDiv.setAttribute("style","display: none;");
            }
        }
    }

    /*
     * Check TCP
     */
    async changeTCP(event: any): Promise<void> {
        let checked = event.target.checked;
        let checkboxField = document.getElementById("new-rule-tcp");
        let valueField = document.getElementById("new-rule-tcpports");
        if(checkboxField != null) {
            if(checked) {
                if (valueField != null) {
                    valueField.setAttribute("value", "");
                    valueField.removeAttribute("disabled");
                }
            } else {
                if (valueField != null) {
                    valueField.setAttribute("disabled", "disabled");
                    valueField.setAttribute("placeholder","80,443,8080...");
                }
            }
        }
    }

    /*
     * Check UDP
     */
    async changeUDP(event: any): Promise<void> {
        let checked = event.target.checked;
        let checkboxField = document.getElementById("new-rule-udp");
        let valueField = document.getElementById("new-rule-udpports");
        if(checkboxField != null) {
            if(checked) {
                if (valueField != null) {
                    valueField.setAttribute("value", "");
                    valueField.removeAttribute("disabled");
                }
            } else {
                if (valueField != null) {
                    valueField.setAttribute("disabled", "disabled");
                    valueField.setAttribute("placeholder","53,61,137...");
                }
            }
        }
    }

    /*
     * Hide Component
     */
    hideComponent(divId: string): void {
        let modalDiv = document.getElementById(divId);
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade");
            modalDiv.setAttribute("aria-modal", "false");
            modalDiv.setAttribute("role", "");
            modalDiv.setAttribute("aria-hidden", "true");
            modalDiv.setAttribute("style","display: none;");
        }
        this.fullReload();
        this.myInterval = setInterval(() =>{ this.reloadComponent(); }, 30000);
    }

    validatePorts(): void {
        let blah = RegExp('/[[:digit:]][,?[[:digit:]]*/g');
    }

    /*
     * Process Target
     */
    async processTarget(inputTarget: any): Promise<FirewallTarget> {
        let thisTarget = new FirewallTarget;
        Object.keys(inputTarget).forEach(key => {
            if (key == this.firewallLabels.VirtualMachine) {
                thisTarget.type = "VirtualMachine";
                thisTarget.value = inputTarget[this.firewallLabels.VirtualMachine];
            } else if (key == this.firewallLabels.VirtualMachinePool) {
                thisTarget.type = "VirtualMachinePool";
                thisTarget.value = inputTarget[this.firewallLabels.VirtualMachinePool];
            } else if (key == this.firewallLabels.Cluster) {
                thisTarget.type = "Cluster";
                thisTarget.value = inputTarget[this.firewallLabels.Cluster];
            } else if (key == this.firewallLabels.ClusterMasterPool) {
                thisTarget.type = "ClusterMasterPool";
                thisTarget.value = inputTarget[this.firewallLabels.ClusterMasterPool];
            } else if (key == this.firewallLabels.ClusterWorkerPool) {
                thisTarget.type = "ClusterWorkerPool";
                thisTarget.value = inputTarget[this.firewallLabels.ClusterWorkerPool];
            }
        });
        return thisTarget;
    }

    /*
     * Process Ingress
     */
    async processIngress(ingressObj: any): Promise<FirewallFilter> {
        let thisFilter = new FirewallFilter;
        for(let k = 0; k < ingressObj.from.length; k++) {
            let thisFrom = ingressObj.from[k];
            Object.keys(thisFrom).forEach(key => {
                if (key == "ipBlock") {
                    thisFilter.type = "ipBlock";
                    thisFilter.value = thisFrom.ipBlock.cidr;
                } else if (key == "podSelector") {
                    let theseLabels = thisFrom.podSelector.matchLabels;
                    Object.keys(theseLabels).forEach(labels => {
                        if(labels == this.firewallLabels.VirtualMachine) {
                            thisFilter.type = "VirtualMachine";
                            thisFilter.value = theseLabels[this.firewallLabels.VirtualMachine];
                        } else if(labels == this.firewallLabels.VirtualMachinePool) {
                            thisFilter.type = "VirtualMachinePool";
                            thisFilter.value = theseLabels[this.firewallLabels.VirtualMachinePool];
                        } else if(labels == this.firewallLabels.Cluster) {
                            thisFilter.type = "Cluster";
                            thisFilter.value = theseLabels[this.firewallLabels.Cluster];
                        } else if(labels == this.firewallLabels.ClusterMasterPool) {
                            thisFilter.type = "ClusterMasterPool";
                            thisFilter.value = theseLabels[this.firewallLabels.ClusterMasterPool];
                        } else if(labels == this.firewallLabels.ClusterWorkerPool) {
                            thisFilter.type = "ClusterWorkerPool";
                            thisFilter.value = theseLabels[this.firewallLabels.ClusterWorkerPool];
                        }
                    });
                } else if (key == this.firewallLabels.namespaceSelector) {
                    thisFilter.type = "namespaceSelector";
                    thisFilter.value = thisFrom.namespaceSelector[this.firewallLabels.namespaceSelector];
                }
            });
        }
        for(let i = 0; i < ingressObj.ports.length; i++) {
            let thisPair = new FirewallPairs;
            thisPair.protocol = ingressObj.ports[i].protocol;
            thisPair.port = ingressObj.ports[i].port;
            thisFilter.pairs.push(thisPair);
        }
        return thisFilter;
    }

    /*
     * Process Egree
     */
    async processEgress(egressObj: any): Promise<FirewallFilter> {
        let thisFilter = new FirewallFilter;
        for(let k = 0; k < egressObj.to.length; k++) {
            let thisTo = egressObj.to[k];
            Object.keys(thisTo).forEach(key => {
                if (key == "ipBlock") {
                    thisFilter.type = "ipBlock";
                    thisFilter.value = thisTo.ipBlock.cidr;
                } else if (key == "podSelector") {
                    let theseLabels = thisTo.podSelector.matchLabels;
                    Object.keys(theseLabels).forEach(labels => {
                        if(labels == this.firewallLabels.VirtualMachine) {
                            thisFilter.type = "VirtualMachine";
                            thisFilter.value = theseLabels[this.firewallLabels.VirtualMachine];
                        } else if(labels == this.firewallLabels.VirtualMachinePool) {
                            thisFilter.type = "VirtualMachinePool";
                            thisFilter.value = theseLabels[this.firewallLabels.VirtualMachinePool];
                        } else if(labels == this.firewallLabels.Cluster) {
                            thisFilter.type = "Cluster";
                            thisFilter.value = theseLabels[this.firewallLabels.Cluster];
                        } else if(labels == this.firewallLabels.ClusterMasterPool) {
                            thisFilter.type = "ClusterMasterPool";
                            thisFilter.value = theseLabels[this.firewallLabels.ClusterMasterPool];
                        } else if(labels == this.firewallLabels.ClusterWorkerPool) {
                            thisFilter.type = "ClusterWorkerPool";
                            thisFilter.value = theseLabels[this.firewallLabels.ClusterWorkerPool];
                        }
                    });
                } else if (key == this.firewallLabels.namespaceSelector) {
                    thisFilter.type = "namespaceSelector";
                    thisFilter.value = thisTo.namespaceSelector[this.firewallLabels.namespaceSelector];
                }
            });
        }
        for(let i = 0; i < egressObj.ports.length; i++) {
            let thisPair = new FirewallPairs;
            thisPair.protocol = egressObj.ports[i].protocol;
            thisPair.port = egressObj.ports[i].port;
            thisFilter.pairs.push(thisPair);
        }
        return thisFilter;
    }

    /*
     * Reload this component
     */
    async reloadComponent(): Promise<void> {
        await this.loadRules();
        await this.cdRef.detectChanges();
    }

    /*
     * Full Reload
     */
    fullReload(): void {
        this.router.navigateByUrl('/refresh',{skipLocationChange:true}).then(()=>{
            this.router.navigate([`/firewalls`]);
        })
    }

}
