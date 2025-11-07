import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, lastValueFrom } from 'rxjs';
import { K8sHPA } from 'src/app/models/k8s-hpa.model';
import { K8sApisService } from 'src/app/services/k8s-apis.service';
import { K8sService } from 'src/app/services/k8s.service';
import { KubeVirtService } from 'src/app/services/kube-virt.service';
import { HorizontalPodAutoscaler } from 'src/app/interfaces/horizontal-pod-autoscaler';
import { Config } from 'datatables.net';
import { Constants } from 'src/app/constants';

@Component({
  selector: 'app-autoscale',
  templateUrl: './autoscale.component.html',
  styleUrls: ['./autoscale.component.css']
})
export class AutoscaleComponent implements OnInit {

    myConstants!: Constants;
    hpaList: K8sHPA[] = [];

    /*
     * Dynamic Tables
     */
    hpaList_dtOptions: Config = {
        paging: false,
        info: false,
        ordering: true,
        orderMulti: true,
        search: true,
        destroy: false,
        stateSave: false,
        serverSide: false,
        columnDefs: [{ orderable: false, targets: 0 }, { orderable: false, targets: 11 }],
        order: [[1, 'asc']],
    };
    hpaList_dtTrigger: Subject<any> = new Subject<any>();

    constructor(
        private router: Router,
        private k8sService: K8sService,
        private k8sApisService: K8sApisService,
        private kubeVirtService: KubeVirtService
    ) { }

    async ngOnInit(): Promise<void> {
        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren("Auto Scaling");
        }
        this.myConstants = new Constants();
        await this.getHPAs();
        this.hpaList_dtTrigger.next(null);
    }

    ngOnDestroy() {
        this.hpaList_dtTrigger.unsubscribe();
    }

    /*
     * Load HPA List that is managed by us
     */
    async getHPAs(): Promise<void> {
        this.hpaList = [];
        const data = await lastValueFrom(this.k8sApisService.getHpas());
        let hpas = data.items;
        for (let i = 0; i < hpas.length; i++) {
            let thisHpa = new K8sHPA();
            thisHpa.name = hpas[i].metadata["name"];
            thisHpa.namespace = hpas[i].metadata["namespace"];
            thisHpa.creationTimestamp = new Date(hpas[i].metadata["creationTimestamp"]);
            thisHpa.scaleTarget = hpas[i].spec.scaleTargetRef["name"];
            thisHpa.minReplicas = hpas[i].spec["minReplicas"];
            thisHpa.maxReplicas = hpas[i].spec["maxReplicas"];
            thisHpa.metricName = hpas[i].spec.metrics[0].resource["name"];
            thisHpa.metricType = hpas[i].spec.metrics[0].resource.target["type"];
            thisHpa.metricAvg = hpas[i].spec.metrics[0].resource.target["averageUtilization"];
            thisHpa.currentRpl = hpas[i].status["currentReplicas"];
            thisHpa.desiredRpl = hpas[i].status["desiredReplicas"];
            try {
                thisHpa.currAvgUtl = hpas[i].status.currentMetrics[0].resource.current["averageUtilization"];
            } catch (e: any) {
                thisHpa.currAvgUtl = 0;
                console.log(e);
            }
            this.hpaList.push(thisHpa);
        }
    }

    /*
     * Show Delete Window
     */
    showDelete(hpaNamespace: string, hpaName: string): void {
        let modalDiv = document.getElementById("modal-delete");
        let modalTitle = document.getElementById("delete-title");
        let modalBody = document.getElementById("delete-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Delete");
        }
        if(modalBody != null) {
            let hpaNamespaceInput = document.getElementById("delete-namespace");
            let hpaNameInput = document.getElementById("delete-name");
            if(hpaNameInput != null && hpaNamespaceInput != null) {
                hpaNamespaceInput.setAttribute("value", hpaNamespace);
                hpaNameInput.setAttribute("value", hpaName);
                modalBody.replaceChildren("Are you sure you want to delete Sacling Group " + hpaNamespace + " - " + hpaName + "?");
            }
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
     * Show New Window
     */
    async showNew(): Promise<void> {
        let modalDiv = document.getElementById("modal-new");
        let modalTitle = document.getElementById("new-title");
        let modalBody = document.getElementById("new-value");

        let selectorNamespacesField = document.getElementById("new-hpa-namespace");

        /* Load Namespace List and Set Selector */
        let data = await lastValueFrom(this.k8sService.getNamespaces());
        let nsSelectorOptions = "";
        for (let i = 0; i < data.items.length; i++) {
            nsSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
        }
        if (selectorNamespacesField != null) {
            selectorNamespacesField.innerHTML = nsSelectorOptions;
        }

        if(modalTitle != null) {
            modalTitle.replaceChildren("New Scaling Group");
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
     * Show Edit Window
     */
    async showEdit(namespace: string,
                  name: string,
                  minReplicas: number,
                  maxReplicas: number,
                  metricAvg: number): Promise<void> {
        let modalDiv = document.getElementById("modal-edit");
        let modalTitle = document.getElementById("edit-title");
        let modalBody = document.getElementById("edit-value");

        if(modalTitle != null) {
            modalTitle.replaceChildren("Config Scaling Group");
        }

        let modalHpaNamespace = document.getElementById("edit-hpa-namespace");
        let modalHpaName = document.getElementById("edit-hpa-name");
        let modalHpaMinReplicas = document.getElementById("edit-hpa-min");
        let modalHpaMaxReplicas = document.getElementById("edit-hpa-max");
        let modalHpaMetricAvg = document.getElementById("edit-hpa-threshold");

        if (modalHpaNamespace != null && modalHpaName != null && modalHpaMinReplicas != null &&
            modalHpaMaxReplicas != null && modalHpaMetricAvg != null ) {

            modalHpaNamespace.setAttribute("value", namespace);
            modalHpaName.setAttribute("value", name);
            modalHpaMinReplicas.setAttribute("value", minReplicas.toString());
            modalHpaMaxReplicas.setAttribute("value", maxReplicas.toString());
            modalHpaMetricAvg.setAttribute("value", metricAvg.toString());
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
     * Apply Edit
     */
    async applyEdit(namespace: string,
        name: string,
        minReplicas: string,
        maxReplicas: string,
        metricAvg: string): Promise<void> {
            
        try {
            let patchService = await lastValueFrom(this.k8sApisService.patchHpa(namespace, name, Number(minReplicas), Number(maxReplicas), Number(metricAvg)));
            this.hideComponent("modal-edit");
            this.fullReload();
        } catch (e: any) {
            alert(e.error.message);
            console.log(e);
        }
    }

    /*
     * New HPA: Load Pool List
     */
    async onChangeNamespace(namespace: string) {
        let selectorPoolField = document.getElementById("new-hpa-targetpool");
        let vmPoolSelectorOptions = "";
        let data = await lastValueFrom(this.kubeVirtService.getVMPoolsNamespaced(namespace));
        let vmPoolList = data.items;
        for (let i = 0; i < vmPoolList.length; i++) {
            if(namespace == vmPoolList[i].metadata["namespace"]) {
                vmPoolSelectorOptions += "<option value=" + vmPoolList[i].metadata["name"] + ">" + vmPoolList[i].metadata["name"] + "</option>\n";
            }
        }
        if (selectorPoolField != null) {
            selectorPoolField.innerHTML = vmPoolSelectorOptions;
        }
    }

    /*
     * Delete Kubernetes Service
     */
    async applyDelete(): Promise<void> {
        let nameField = document.getElementById("delete-name");
        let namespaceField = document.getElementById("delete-namespace");
        if(nameField != null && namespaceField != null) {
            let hpaNamespace = namespaceField.getAttribute("value");
            let hpaName = nameField.getAttribute("value");
            if(hpaName != null && hpaNamespace != null) {
                try {
                    let deleteService = await lastValueFrom(this.k8sApisService.deleteHPA(hpaNamespace, hpaName));
                    this.hideComponent("modal-delete");
                    this.fullReload();
                } catch (e: any) {
                    alert(e.error.message);
                    console.log(e);
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
    }

    /*
     * Create New HPA
     */
    async applyNew(
        newhpaname: string,
        newhpanamespace: string,
        newhpatargetpool: string,
        newhpamin: string,
        newhpamax: string,
        newhpathreshold: string
        ): Promise<void> {
        if(newhpaname == "") {
            alert("You must select a name for your Sacling Group!");
        } else if (newhpatargetpool == "" || newhpamin == "" || newhpamax == "" || newhpathreshold == "") {
            alert("Please complete all the target properties!");
        } else {

            let myHpaDescriptor: HorizontalPodAutoscaler = {
                apiVersion: "autoscaling/v2",
                kind: "HorizontalPodAutoscaler",
                metadata: {
                    name: newhpaname,
                    namespace: newhpanamespace,
                    labels: {
                        [this.myConstants.KubevirtManagerManaged]: "true"
                    }
                },
                spec: {
                    scaleTargetRef: {
                        apiVersion: "pool.kubevirt.io/v1alpha1",
                        kind: "VirtualMachinePool",
                        name: newhpatargetpool,
                    },
                    minReplicas: Number(newhpamin),
                    maxReplicas: Number(newhpamax),
                    metrics: [{
                        type: "Resource",
                        resource: {
                            name: "cpu",
                            target: {
                                type: "Utilization",
                                averageUtilization: Number(newhpathreshold),
                            }
                        },         
                    }],
                },
            };

            try {
                let newHpaData = await lastValueFrom(this.k8sApisService.createHpa(myHpaDescriptor));
                this.hideComponent("modal-new");
                this.fullReload();
            } catch (e: any) {
                alert(e.error.message);
                console.log(e);
            }
        }
    }

    /*
     * full reload
     */
    fullReload(): void {
        this.router.navigateByUrl('/refresh',{skipLocationChange:true}).then(()=>{
            this.router.navigate([`/autoscale`]);
        })
    }

}
