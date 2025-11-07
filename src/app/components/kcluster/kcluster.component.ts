import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Buffer } from 'buffer';
import { Subject, lastValueFrom } from 'rxjs';
import { KCluster } from 'src/app/models/kcluster.model';
import { K8sApisService } from 'src/app/services/k8s-apis.service';
import { K8sService } from 'src/app/services/k8s.service';
import { KubeVirtService } from 'src/app/services/kube-virt.service';
import { KubevirtMgrCapk } from 'src/app/services/kubevirt-mgr-capk.service';
import { XK8sService } from 'src/app/services/x-k8s.service';
import { DataVolume } from 'src/app/interfaces/data-volume';
import { KubeadmControlPlane } from 'src/app/interfaces/kubeadm-control-plane';
import { Cluster } from 'src/app/interfaces/cluster';
import { KubevirtCluster } from 'src/app/interfaces/kubevirt-cluster';
import { KubevirtMachineTemplate } from 'src/app/interfaces/kubevirt-machine-template';
import { MachineDeployment } from 'src/app/interfaces/machine-deployment'
import { KubeadmConfigTemplate } from 'src/app/interfaces/kubeadm-config-template';
import { Secret } from 'src/app/interfaces/secret';
import { ClusterResourceSet } from 'src/app/interfaces/cluster-resource-set';
import { ServiceAccount } from 'src/app/interfaces/service-account';
import { RoleBinding } from 'src/app/interfaces/role-binding';
import { ConfigMap } from 'src/app/interfaces/config-map';
import { Deployment } from 'src/app/interfaces/deployment';
import { ClusterRoleBinding } from 'src/app/interfaces/cluster-role-binding';
import { FirewallLabels } from 'src/app/models/firewall-labels.model';
import { FormGroup, FormBuilder, FormArray } from '@angular/forms';
import { Config } from 'datatables.net';
import { Constants } from 'src/app/constants';

@Component({
  selector: 'app-kcluster',
  templateUrl: './kcluster.component.html',
  styleUrls: ['./kcluster.component.css']
})
export class KClusterComponent implements OnInit {

    myConstants!: Constants;
    crdList: any;
    cdiCheck: boolean = false;
    clusterList: KCluster[] = [];
    clusterImageList: any;
    cniList: any;
    featureList: any;
    charDot = '.';
    firewallLabels: FirewallLabels = new FirewallLabels;

    /*
     * Dynamic Forms
     */
    ctrlPlaneAnnotationList: FormGroup;
    ctrlPlaneLabelList: FormGroup;
    annotationList: FormGroup;
    labelList: FormGroup;

    /*
     * Dynamic Tables
     */
    kclusterList_dtOptions: Config = {
        paging: false,
        info: false,
        ordering: true,
        orderMulti: true,
        search: true,
        destroy: false,
        stateSave: false,
        serverSide: false,
        columnDefs: [{ orderable: false, targets: 0 }, { orderable: false, targets: 8 }],
        order: [[1, 'asc']],
    };
    kclusterList_dtTrigger: Subject<any> = new Subject<any>();

    constructor(
        private router: Router,
        private kubevirtMgrCapk: KubevirtMgrCapk,
        private k8sService: K8sService,
        private k8sApisService: K8sApisService,
        private kubeVirtService: KubeVirtService,
        private xK8sService: XK8sService,
        private fb: FormBuilder
    ) {
        this.ctrlPlaneAnnotationList = this.fb.group({
            ctrlannotations: this.fb.array([]),
        });
        this.ctrlPlaneLabelList = this.fb.group({
            ctrllabels: this.fb.array([]),
        });
        this.annotationList = this.fb.group({
            annotations: this.fb.array([]),
        });
        this.labelList = this.fb.group({
            labels: this.fb.array([]),
        });
     }

    async ngOnInit(): Promise<void> {
        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren("Kubernetes Clusters");
        }
        this.myConstants = new Constants();
        await this.getClusters();
        await this.loadCrds();
        await this.checkCDI();
        this.kclusterList_dtTrigger.next(null);
        this.ctrlPlaneAnnotationList = this.fb.group({
            ctrlannotations: this.fb.array([]),
        });
        this.ctrlPlaneLabelList = this.fb.group({
            ctrllabels: this.fb.array([]),
        });
        this.annotationList = this.fb.group({
            annotations: this.fb.array([]),
        });
        this.labelList = this.fb.group({
            labels: this.fb.array([]),
        });
    }

    ngOnDestroy() {
        this.kclusterList_dtTrigger.unsubscribe();
    }

    /* Getting the Control Plane Annotations FormArray */
    get ctrlannotations(): FormArray {
        return this.ctrlPlaneAnnotationList.get('ctrlannotations') as FormArray;
    }

    /* Control Plane Annotation FormGroup */
    createCtrlAnnotationGroup(): FormGroup {
        return this.fb.group({
            ctrlAnnotKey: [''],
            ctrlAnnotValue: [''],
        })
    }

    /* Add a new Control Plane Annotation entry to the Group */
    addCtrlAnnotation(): void {
        this.ctrlannotations.push(this.createCtrlAnnotationGroup());
    }

    /* Remove Control Plane Annotation entry from the Group */
    removeCtrlAnnotation(index: number): void {
        this.ctrlannotations.removeAt(index);
    }

    /* Getting all the Control Plane annotations */
    getCtrlAnnotations(): any[] {
        return this.ctrlPlaneAnnotationList.value.ctrlannotations;
    }

    /*
     * Control Plane Annotation Form Validation
     */
    validateCtrlAnnotations(): boolean {
        let toValidate = this.getCtrlAnnotations();
        if (toValidate.length > 0) {
            for (let i = 0; i < toValidate.length; i ++) {
                if (toValidate[i].ctrlAnnotKey == "" || toValidate[i].ctrlAnnotValue == "") {
                    alert("Control Plane Service Annotation " + i + " should have Key and Value filled in.")
                    return false;
                } 
            }
        }
        return true;
    }


    /* Getting the Control Plane Labels FormArray */
    get ctrllabels(): FormArray {
        return this.ctrlPlaneLabelList.get('ctrllabels') as FormArray;
    }

    /* Control Plane Label FormGroup */
    createCtrlLabelGroup(): FormGroup {
        return this.fb.group({
            ctrlLabelKey: [''],
            ctrlLabelValue: [''],
        })
    }

    /* Add a new Control Plane Label entry to the Group */
    addCtrlLabel(): void {
        this.ctrllabels.push(this.createCtrlLabelGroup());
    }

    /* Remove Control Plane Label entry from the Group */
    removeCtrlLabel(index: number): void {
        this.ctrllabels.removeAt(index);
    }

    /* Getting all the Control Plane labels */
    getCtrlLabels(): any[] {
        return this.ctrlPlaneLabelList.value.ctrllabels;
    }

    /*
     * Control Plane Label Form Validation
     */
    validateCtrlLabels(): boolean {
        let toValidate = this.getCtrlLabels();
        if (toValidate.length > 0) {
            for (let i = 0; i < toValidate.length; i ++) {
                if (toValidate[i].ctrlLabelKey == "" || toValidate[i].ctrlLabelValue == "") {
                    alert("Control Plane Service Label " + i + " should have Key and Value filled in.")
                    return false;
                } 
            }
        }
        return true;
    }







    /* Getting the Annotations FormArray */
    get annotations(): FormArray {
        return this.annotationList.get('annotations') as FormArray;
    }

    /* Annotation FormGroup */
    createAnnotationGroup(): FormGroup {
        return this.fb.group({
            annotKey: [''],
            annotValue: [''],
        })
    }

    /* Add a new Annotation entry to the Group */
    addAnnotation(): void {
        this.annotations.push(this.createAnnotationGroup());
    }

    /* Remove Annotation entry from the Group */
    removeAnnotation(index: number): void {
        this.annotations.removeAt(index);
    }

    /* Getting all the annotations */
    getAnnotations(): any[] {
        return this.annotationList.value.annotations;
    }

    /*
     * Annotation Form Validation
     */
    validateAnnotations(): boolean {
        let toValidate = this.getAnnotations();
        if (toValidate.length > 0) {
            for (let i = 0; i < toValidate.length; i ++) {
                if (toValidate[i].annotKey == "" || toValidate[i].annotValue == "") {
                    alert("Annotation " + i + " should have Key and Value filled in.")
                    return false;
                } 
            }
        }
        return true;
    }

    /* Getting the Labels FormArray */
    get labels(): FormArray {
        return this.labelList.get('labels') as FormArray;
    }

    /* Label FormGroup */
    createLabelGroup(): FormGroup {
        return this.fb.group({
            labelKey: [''],
            labelValue: [''],
        });
    }

    /* Add a new Label entry to the Group */
    addLabel(): void {
        this.labels.push(this.createLabelGroup());
    }

    /* Remove Label entry from the Group */
    removeLabel(index: number): void {
        this.labels.removeAt(index);
    }

    /* Getting all the labels */
    getLabels(): any[] {
        return this.labelList.value.labels;
    }

    /*
     * Label Form Validation
     */
    validateLabels(): boolean {
        let toValidate = this.getLabels();
        if (toValidate.length > 0) {
            for (let i = 0; i < toValidate.length; i ++) {
                if (toValidate[i].labelKey == "" || toValidate[i].labelValue == "") {
                    alert("Label " + i + " should have Key and Value filled in.")
                    return false;
                }
            }
        }
        return true;
    }

    /*
     * Load Image List for Cluster
     */
    async loadClusterImages(): Promise<void> {
        try {
            const data = await lastValueFrom(this.kubevirtMgrCapk.loadImages());
            this.clusterImageList = data;
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Load Image List for Cluster
     */
    async loadCNIList(): Promise<void> {
        try {
            const data = await lastValueFrom(this.kubevirtMgrCapk.loadCNIs());
            this.cniList = data;
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Load Feature List for Cluster
     */
    async loadFeatureList(): Promise<void> {
        try {
            const data = await lastValueFrom(this.kubevirtMgrCapk.loadFeatures());
            this.featureList = data;
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Load Cluster List
     */
     async getClusters(): Promise<void> {
        this.clusterList = [];
        const data = await lastValueFrom(this.xK8sService.getClusters());
        let clusters = data.items;
        for(let i = 0; i < clusters.length; i++) {
            let thisCluster = new KCluster();
            thisCluster.name = clusters[i].metadata.name;
            thisCluster.namespace = clusters[i].metadata.namespace;
            thisCluster.cpHost = clusters[i].spec.controlPlaneEndpoint.host;
            thisCluster.cpPort = clusters[i].spec.controlPlaneEndpoint.port;
            thisCluster.cpName = clusters[i].spec.controlPlaneRef.name;
            thisCluster.cpNamespace = clusters[i].spec.controlPlaneRef.namespace;
            thisCluster.infName = clusters[i].spec.infrastructureRef.name;
            thisCluster.infNamespace = clusters[i].spec.infrastructureRef.namespace;
            //for(let j = 0; j < clusters[i].spec.clusterNetwork.pods.cidrBlocks.length; j++) {
            //    thisCluster.podCidrs += clusters[i].spec.clusterNetwork.pods.cidrBlocks[j];
            //}
            //for(let j = 0; j < clusters[i].spec.clusterNetwork.services.cidrBlocks.length; j++) {
            //    thisCluster.svcCidrs += clusters[i].spec.clusterNetwork.services.cidrBlocks[j];
            //}
            try {
                if(clusters[i].status.controlPlaneReady != null) {
                    thisCluster.controlPlaneReady = clusters[i].status.controlPlaneReady;
                } else {
                    thisCluster.controlPlaneReady = false;
                }
            } catch (e) {
                thisCluster.controlPlaneReady = false;
            }
            try {
                if (clusters[i].status.infrastructureReady != null) {
                    thisCluster.infrastructureReady = clusters[i].status.infrastructureReady;
                } else {
                    thisCluster.infrastructureReady = false;
                }
            } catch (e: any) {
                thisCluster.infrastructureReady = false;
                console.log(e);
            }

            /* Loading MachineDeployments information */
            let data = await lastValueFrom(this.xK8sService.getClusterMachineDeployments(thisCluster.namespace, thisCluster.name));
            let workerpools = data.items;
            for(let j = 0; j < workerpools.length; j++) {
                thisCluster.totalWorkers += workerpools[j].spec.replicas;
                //let thisWorker = workerpools[j];
                //let thisWorkerPool = new KClusterMachineDeployment();
                //thisWorkerPool.name = thisWorker.metadata.name;
                //thisWorkerPool.namespace = thisWorker.metadata.namespace;
                //thisWorkerPool.clusterName = thisWorker.spec.clusterName;
                //thisWorkerPool.replicas = thisWorker.spec.replicas;
                //thisWorkerPool.version = thisWorker.spec.template.spec.version;
                //let workertemplate = await lastValueFrom(this.xK8sService.getKubevirtMachineTemplate(thisWorker.spec.template.spec.infrastructureRef.namespace, thisWorker.spec.template.spec.infrastructureRef.name));
                //let thisWorkerTemplate = new KClusterKubevirtMachineTemplate;
                //thisWorkerTemplate.name = workertemplate.metadata.name;
                //thisWorkerTemplate.namespace = workertemplate.metadata.namespace;
                //try {
                //    thisWorkerTemplate.clusterName = workertemplate.metadata.ownerReferences[0].name;
                //} catch (e: any) {
                //    thisWorkerTemplate.clusterName = "N/A";
                //    console.log(e);
                //}
                //thisWorkerPool.machineTemplate = thisWorkerTemplate;
                //thisCluster.machineDeployments.push(thisWorkerPool);
                thisCluster.workerPools += 1;
            }

            /* Loading Control Plane information */
            data = await lastValueFrom(this.xK8sService.getClusterControlPlane(thisCluster.namespace, thisCluster.cpName));
            //let thisControlPlane = new KClusterKubeadmControlPlane();
            //thisControlPlane.name = data.metadata.name;
            //thisControlPlane.namespace = data.metadata.namespace;
            //try {
            //    thisControlPlane.clusterName = data.metadata.ownerReferences[0].name;
            //} catch (e: any) {
            //    thisControlPlane.clusterName = "N/A";
            //    console.log(e);
            //}
            //thisControlPlane.dnsDomain = data.spec.kubeadmConfigSpec.clusterConfiguration.networking.dnsDomain;
            //thisControlPlane.podSubnet = data.spec.kubeadmConfigSpec.clusterConfiguration.networking.podSubnet;
            //thisControlPlane.serviceSubnet = data.spec.kubeadmConfigSpec.clusterConfiguration.networking.serviceSubnet;
            //thisControlPlane.replicas = data.spec.replicas;
            //thisControlPlane.version = data.spec.version;
            thisCluster.controlPlane.version = data.spec.version;
            //try {
            //    thisControlPlane.initialized = data.status.initialized;
            //} catch (e: any) {
            //    thisControlPlane.initialized = false;
            //    console.log(e);
            //}
            //try {
            //    thisControlPlane.ready = data.status.ready;
            //} catch (e: any) {
            //    thisControlPlane.ready = false;
            //    console.log(e);
            //}
            //let cptemplate = await lastValueFrom(this.xK8sService.getKubevirtMachineTemplate(data.spec.machineTemplate.infrastructureRef.namespace, data.spec.machineTemplate.infrastructureRef.name));
            //let thisCPTemplate = new KClusterKubevirtMachineTemplate;
            //thisCPTemplate.name = cptemplate.metadata.name;
            //thisCPTemplate.namespace = cptemplate.metadata.namespace;
            //try {
            //    thisCPTemplate.clusterName = cptemplate.metadata.ownerReferences[0].name;
            //} catch (e: any) {
            //    thisCPTemplate.clusterName = "N/A";
            //    console.log(e);
            //}
            //thisControlPlane.machineTemplate = thisCPTemplate;
            //thisCluster.controlPlane = thisControlPlane;
            this.clusterList.push(thisCluster);
        }
    }

    /*
     * Generate Kubeconfig
     */
    async getKubeconfig(namespace: string, name: string): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getSecret(namespace, name + "-kubeconfig"));
            let base64data = data.data.value;
            const src = `data:text/yaml;base64,${base64data}`;
            const link = document.createElement("a");
            link.href = src;
            link.download = namespace + "-" + name + "-kubeconfig";
            link.click();
            link.remove();
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Download SSH Key (capk user)
     */
    async getSSHKey(namespace: string, name: string): Promise<void> {
        try {
            let data = await lastValueFrom(this.k8sService.getSecret(namespace, name + "-ssh-keys"));
            let base64data = data.data.key;
            const src = `data:application/x-pem-file;base64,${base64data}`;
            const link = document.createElement("a");
            link.href = src;
            link.download = namespace + "-" + name + "-ssh.pem";
            link.click();
            link.remove();
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Show New Window
     */
    showNew(): void {
        let modalDiv = document.getElementById("modal-new");
        let modalTitle = document.getElementById("new-title");
        let modalBody = document.getElementById("new-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("New Kubernetes Cluster");
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
     * Show Delete Window
     */
    showDelete(namespace: string, name: string): void {
        let modalDiv = document.getElementById("modal-delete");
        let modalTitle = document.getElementById("delete-title");
        let modalBody = document.getElementById("delete-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Delete");
        }
        if(modalBody != null) {
            let clusterNameInput = document.getElementById("delete-name");
            let clusterNamespaceInput = document.getElementById("delete-namespace");
            if(clusterNameInput != null && clusterNamespaceInput != null) {
                clusterNameInput.setAttribute("value", name);
                clusterNamespaceInput.setAttribute("value", namespace);
                modalBody.replaceChildren("Are you sure you want to delete cluster " + name + " on namespace: " + namespace + "?");
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
     * Delete Cluster
     */
    async applyDelete(): Promise<void> {
        let clusterNameInput = document.getElementById("delete-name");
        let clusterNamespaceInput = document.getElementById("delete-namespace");
        if(clusterNameInput != null && clusterNamespaceInput != null) {
            let clusterName = clusterNameInput.getAttribute("value");
            let clusterNamespace = clusterNamespaceInput.getAttribute("value");
            if(clusterName != null && clusterNamespace != null) {
                try {
                    let configData = await lastValueFrom(this.k8sService.deleteSecret(clusterNamespace, clusterName + "-config"));
                } catch (e: any) {
                    console.log(e);
                }
                try {
                    let controllerData = await lastValueFrom(this.xK8sService.getKCCServices(clusterNamespace, clusterName));
                    for (let i = 0; i < controllerData.items.length; i++) {
                        try {
                            let deleteService = await lastValueFrom(this.k8sService.deleteService(controllerData.items[i].metadata.namespace, controllerData.items[i].metadata.name));
                        } catch (e: any) {
                            console.log(e);
                        }
                    }                    
                } catch (e: any) {
                    console.log(e);
                }
                try {
                    let kccConfig = await lastValueFrom(this.k8sService.deleteConfigMap(clusterNamespace, clusterName + "-kcc"));
                } catch (e: any) {
                    console.log(e);
                }
                try {
                    let resourceSet = await lastValueFrom(this.xK8sService.deleteClusterResourseSet(clusterNamespace, clusterName));
                } catch (e: any) {
                    console.log(e);
                }
                try {
                    let casServiceAcount = await lastValueFrom(this.k8sService.deleteServiceAccount(clusterNamespace, clusterName + "-cas"));
                } catch (e: any) {
                    console.log(e);
                }
                try {
                    let casRBACManagement = await lastValueFrom(this.k8sApisService.deleteClusterRoleBinding(clusterNamespace + "-" + clusterName + "-cas-management"));
                } catch (e: any) {
                    console.log(e);
                }
                try {
                    let casRBACWorkload = await lastValueFrom(this.k8sApisService.deleteClusterRoleBinding(clusterNamespace + "-" + clusterName + "-cas-workload"));
                } catch (e: any) {
                    console.log(e);
                }
                try {
                    let clusterData = await lastValueFrom(this.xK8sService.deleteCluster(clusterNamespace, clusterName));
                    this.hideComponent("modal-delete");
                    this.fullReload();
                } catch (e: any) {
                    console.log(e);
                    alert(e.error.message);
                }
            }
        }
    }

    /*
     * Show New Standard Cluster Window
     */
    async showNewCluster(): Promise<void> {
        this.hideComponent("modal-new");
        let i = 0;
        let modalDiv = document.getElementById("modal-newcluster");
        let modalTitle = document.getElementById("newcluster-title");
        let modalBody = document.getElementById("newcluster-value");

        let selectorNamespacesField = document.getElementById("newcluster-namespace");
        let selectorKubernetesVersionField = document.getElementById("newcluster-version");
        let selectorCNIField = document.getElementById("newcluster-cni");

        let selectorCPTypeField = document.getElementById("newcluster-controlplane-type");
        let selectorNPTypeField = document.getElementById("newcluster-nodepool-type");

        let selectorCPPCField = document.getElementById("newcluster-controlplane-pc");
        let selectorNPPCField = document.getElementById("newcluster-nodepool-pc");

        let selectorCPSCField = document.getElementById("newcluster-controlplane-disksc");
        let selectorNPSCField = document.getElementById("newcluster-nodepool-disksc");

        /* Load Namespace List and Set Selector */
        let data = await lastValueFrom(this.k8sService.getNamespaces());
        let nsSelectorOptions = "";
        for (i = 0; i < data.items.length; i++) {
            nsSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
        }
        if (selectorNamespacesField != null) {
            selectorNamespacesField.innerHTML = nsSelectorOptions;
        }

        /* Show window before loading the rest 
         * to avoid delays
         */
        if(modalTitle != null) {
            modalTitle.replaceChildren("New Kubernetes Cluster");
        }
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }

        /* Load Kubernetes Versions on Selector */
        await this.loadClusterImages();
        let kubernetesVersionSelectorOptions = "<option value=none></option>";
        for (i = 0; i < this.clusterImageList.versions.length; i++) {
            kubernetesVersionSelectorOptions += "<option value=" + this.clusterImageList.versions[i].id +">" + this.clusterImageList.versions[i].name + "</option>\n";
        }
        if (selectorKubernetesVersionField != null) {
            selectorKubernetesVersionField.innerHTML = kubernetesVersionSelectorOptions;
        }

        /* Load CNIs on Selector */
        await this.loadCNIList();
        let kubernetesCNISelectorOptions = "<option value=manual>manual</option>\n";
        for (i = 0; i < this.cniList.cnis.length; i++) {
            kubernetesCNISelectorOptions += "<option value=" + this.cniList.cnis[i].id +">" + this.cniList.cnis[i].name + "</option>\n";
        }
        if (selectorCNIField != null) {
            selectorCNIField.innerHTML = kubernetesCNISelectorOptions;
        }

        /* Load ClusterInstanceType List and Set Selector */
        data = await lastValueFrom(this.kubeVirtService.getClusterInstanceTypes());
        let typeSelectorOptions = "<option value=none></option>";
        for (i = 0; i < data.items.length; i++) {
            typeSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
        }
        if (selectorCPTypeField != null && selectorNPTypeField != null) {
            typeSelectorOptions += "<option value=custom>custom</option>\n";
            selectorCPTypeField.innerHTML = typeSelectorOptions;
            selectorNPTypeField.innerHTML = typeSelectorOptions;
        }

        /* Load Storage Class List and Set Selector */
        data = await lastValueFrom(this.k8sApisService.getStorageClasses());
        let storageSelectorOptions = "";
        for (i = 0; i < data.items.length; i++) {
            storageSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
        }
        if (selectorCPSCField != null && selectorNPSCField != null) {
            selectorCPSCField.innerHTML = storageSelectorOptions;
            selectorNPSCField.innerHTML = storageSelectorOptions;
        }

        /* Load Priority Class List and Set Selector */
        data = await lastValueFrom(this.k8sApisService.getPriorityClasses());
        let prioritySelectorOptions = "";
        for (i = 0; i < data.items.length; i++) {
            if(data.items[i].metadata["name"].toLowerCase() == "vm-standard") {
                prioritySelectorOptions += "<option value=" + data.items[i].metadata["name"] +" selected>" + data.items[i].metadata["name"] + "</option>\n";
            } else {
                prioritySelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
            }
        }
        if (selectorCPPCField != null && selectorNPPCField != null) {
            selectorCPPCField.innerHTML = prioritySelectorOptions;
            selectorNPPCField.innerHTML = prioritySelectorOptions;
        }

        await this.loadFeatureList();

    }

    /*
     * Show New Custom Cluster Window
     */
    async showNewClusterCustom(): Promise<void> {
        this.hideComponent("modal-new");
        let i = 0;
        let modalDiv = document.getElementById("modal-newclustercustom");
        let modalTitle = document.getElementById("newclustercustom-title");
        let modalBody = document.getElementById("newclustercustom-value");

        let selectorNamespacesField = document.getElementById("newclustercustom-namespace");
        let selectorCPTypeField = document.getElementById("newclustercustom-controlplane-type");
        let selectorNPTypeField = document.getElementById("newclustercustom-nodepool-type");

        let selectorCPPCField = document.getElementById("newclustercustom-controlplane-pc");
        let selectorNPPCField = document.getElementById("newclustercustom-nodepool-pc");

        let selectorCPSCField = document.getElementById("newclustercustom-controlplane-disksc");
        let selectorNPSCField = document.getElementById("newclustercustom-nodepool-disksc");

        /* Load Namespace List and Set Selector */
        let data = await lastValueFrom(this.k8sService.getNamespaces());
        let nsSelectorOptions = "";
        for (i = 0; i < data.items.length; i++) {
            nsSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
        }
        if (selectorNamespacesField != null) {
            selectorNamespacesField.innerHTML = nsSelectorOptions;
        }

        /* Show window before loading the rest 
         * to avoid delays
         */
        if(modalTitle != null) {
            modalTitle.replaceChildren("New Kubernetes Cluster");
        }
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }

        /* Load ClusterInstanceType List and Set Selector */
        data = await lastValueFrom(this.kubeVirtService.getClusterInstanceTypes());
        let typeSelectorOptions = "<option value=none></option>";
        for (i = 0; i < data.items.length; i++) {
            typeSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
        }
        if (selectorCPTypeField != null && selectorNPTypeField != null) {
            typeSelectorOptions += "<option value=custom>custom</option>\n";
            selectorCPTypeField.innerHTML = typeSelectorOptions;
            selectorNPTypeField.innerHTML = typeSelectorOptions;
        }

        /* Load Storage Class List and Set Selector */
        data = await lastValueFrom(this.k8sApisService.getStorageClasses());
        let storageSelectorOptions = "";
        for (i = 0; i < data.items.length; i++) {
            storageSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
        }
        if (selectorCPSCField != null && selectorNPSCField != null) {
            selectorCPSCField.innerHTML = storageSelectorOptions;
            selectorNPSCField.innerHTML = storageSelectorOptions;
        }

        /* Load Priority Class List and Set Selector */
        data = await lastValueFrom(this.k8sApisService.getPriorityClasses());
        let prioritySelectorOptions = "";
        for (i = 0; i < data.items.length; i++) {
            if(data.items[i].metadata["name"].toLowerCase() == "vm-standard") {
                prioritySelectorOptions += "<option value=" + data.items[i].metadata["name"] +" selected>" + data.items[i].metadata["name"] + "</option>\n";
            } else {
                prioritySelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
            }
        }
        if (selectorCPPCField != null && selectorNPPCField != null) {
            selectorCPPCField.innerHTML = prioritySelectorOptions;
            selectorNPPCField.innerHTML = prioritySelectorOptions;
        }

    }

    /*
     * Create new Standard Cluster
     */
    async applyNewCluster(
        clustername: string,
        clusternamespace: string,
        clusterversion: string,
        clustercni: string,
        clustercniversion: string,
        clusterautoscaler: string,
        clusterdns: string,
        clusterpodcidr: string,
        clustersvccidr: string,
        clusternetwork: string,
        clusternetworktype: string,
        clustercontrolplaneeptype: string,
        clustercontrolplaneosdist: string,
        clustercontrolplaneosversion: string,
        clustercontrolplanetype: string,
        clustercontrolplanecpumemsockets: string,
        clustercontrolplanecpumemcores: string,
        clustercontrolplanecpumemthreads: string,
        clustercontrolplanecpumemmemory: string,
        clustercontrolplanepc: string,
        clustercontrolplanefirmware: string,
        clustercontrolplanesecureboot: string,
        clustercontrolplanereplicas: string,
        clustercontrolplanedisksize: string,
        clustercontrolplanedisksc: string,
        clustercontrolplanediskam: string,
        clustercontrolplanediskcm: string,
        clusternodepoolname: string,
        clusternodepoolosdist: string,
        clusternodepoolosversion: string,
        clusternodepooltype: string,
        clusternodepoolcpumemsockets: string,
        clusternodepoolcpumemcores: string,
        clusternodepoolcpumemthreads: string,
        clusternodepoolcpumemmemory: string,
        clusternodepoolpc: string,
        clusternodepoolfirmware: string,
        clusternodepoolsecureboot: string,
        clusternodepoolreplicas: string,
        clusternodepoolminreplicas: string,
        clusternodepoolmaxreplicas: string,
        clusternodepooldisksize: string,
        clusternodepooldisksc: string,
        clusternodepooldiskam: string,
        clusternodepooldiskcm: string,
        clusterfeaturescertmanager: boolean,
        clusterfeaturesdashboard: boolean,
        clusterfeaturesmetrics: boolean,
        clusterfeatureshaproxyingress: boolean,
        clusterfeaturesnginxingress: boolean,
        clusterfeaturestekton: boolean
    ) {

        /* Loading control plane data needed for validation */
        let controlPlaneTypedCpus = 0;
        if(clustercontrolplanetype != "custom" && clustercontrolplanetype != "")
        {
            try {
                const data = await lastValueFrom(this.kubeVirtService.getClusterInstanceType(clustercontrolplanetype));
                controlPlaneTypedCpus = Number(data.spec.cpu["guest"]);
            } catch (e: any) {
                console.log(e);
            }
        }

        /*
         * Basic Field Validation
         */
        if(clustername == "" || clusternamespace == "") {
            alert("You need to fill in the name and namespace fields!");
        } else if(clustername.includes(this.charDot)) {
            alert("Your cluster name should not have . (dot) character!");
        } else if ((clustercni != "" && clustercni.toLowerCase() != "none" && clustercni.toLowerCase() != "manual") && (clustercniversion == "" || clustercniversion.toLowerCase() == "none")) {
            alert("Your must select a CNI version for" + clustercni + "!");
        } else if (clusterdns == "") {
            alert("Cluster DNS should not be empty");
        } else if (clustercontrolplaneosdist == "none" || clustercontrolplaneosdist == "") {
            alert("Choose an Operating System for your Control Plane!");
        } else if (clusterversion == "" || clusterversion.toLowerCase() == "none") {
            alert("You need to select a Kubernetes Version for you cluster!");
        } else if (clustercontrolplaneeptype == "" || clustercontrolplaneeptype.toLowerCase() == "none") {
            alert("Please select an Endpoint Type for you Kubernetes API!");
        } else if(this.checkClusterExists(clustername, clusternamespace)) {
            alert("Cluster with name/namespace combination already exists!");
        } else if(clustercontrolplanetype.toLowerCase() == "none" || clustercontrolplanetype.toLowerCase() == "") {
            alert("Please select a valid VM Type for Control Plane!");
        } else if(clusternodepooltype.toLowerCase() == "none" || clusternodepooltype.toLowerCase() == "") {
            alert("Please select a valid VM Type for Node Pool!");
        } else if(Number(clustercontrolplanereplicas)%2 == 0 || Number(clustercontrolplanereplicas) == 0 || clustercontrolplanereplicas == "") {
            alert("Control Plane replicas number needs to be an odd number!");
        } else if(clustercontrolplanedisksize == "") {
            alert("Check Control Plane disk size!");
        } else if(clusternodepoolosdist == "none" || clusternodepoolosdist == "") {
            alert("Choose an Operating System for your Node Pool!");
        } else if(clusternodepooldisksize == "") {
            alert("Check Node Pool disk size!");
        } else if(Number(clusternodepoolreplicas) == 0 || clusternodepoolreplicas == "") {
            alert("Please check your Node Pool replicas number!");
        } else if((clustercontrolplanetype.toLowerCase() == "custom") && (clustercontrolplanecpumemsockets == "" || clustercontrolplanecpumemcores == "" || clustercontrolplanecpumemthreads == "" || clustercontrolplanecpumemmemory == "")) {
            alert("To use Control Plane with Custom Type, you must fill in all CPU and Memory fields!");
        } else if((clusternodepooltype.toLowerCase() == "custom") && (clusternodepoolcpumemsockets == "" || clusternodepoolcpumemcores == "" || clusternodepoolcpumemthreads == "" || clusternodepoolcpumemmemory == "")) {
            alert("To use Node Pool with Custom Type, you must fill in all CPU and Memory fields!");
        } else if((clustercontrolplanetype == "custom") && ((Number(clustercontrolplanecpumemcores) * Number(clustercontrolplanecpumemsockets) * Number(clustercontrolplanecpumemthreads)) < 2 )) {
            alert("Control Plane machines needs at least 2 vCPU!");
        } else if(clustercontrolplanetype != "custom" && controlPlaneTypedCpus < 2) {
            alert("Control Plane machines needs at least 2 vCPU, choose a bigger VM Type!");
        } else if (this.validateAnnotations() && this.validateCtrlAnnotations() && this.validateLabels() && this.validateCtrlLabels()) {

            /* Auto Fill CIDR Blocks */
            if(clusterpodcidr == "") {
                clusterpodcidr = "10.243.0.0/16";
            }
            if(clustersvccidr == "") {
                clustersvccidr = "10.95.0.0/16";
            }

            let clustercontrolplaneimageurl = this.getImageUrl(clusterversion, clustercontrolplaneosdist, clustercontrolplaneosversion);
            let clusternodepoolimageurl = this.getImageUrl(clusterversion, clusternodepoolosdist, clusternodepoolosversion);

            /* Generate random VXLAN Port */
            let clustercnivxlanport = "";
            if (clustercni != "manual") {
                clustercnivxlanport = this.generateVXLANPort().toString();
            }

            /* Create Cluster Related Objects */
            try {
                this.createClusterRelatedObjects(clustername,
                                            clusternamespace,
                                            clustercni,
                                            clustercniversion,
                                            clustercnivxlanport,
                                            clusterpodcidr,
                                            clustersvccidr,
                                            clusterautoscaler,
                                            clustercontrolplaneeptype);

                this.createControlPlaneRelatedObjects(clustername,
                                            clusternamespace,
                                            clusterversion,
                                            clusterdns,
                                            clusterpodcidr,
                                            clustersvccidr,
                                            clusternetwork,
                                            clusternetworktype,
                                            clustercontrolplaneosdist,
                                            clustercontrolplaneosversion,
                                            clustercontrolplaneimageurl,
                                            clustercontrolplanetype,
                                            clustercontrolplanecpumemsockets,
                                            clustercontrolplanecpumemcores,
                                            clustercontrolplanecpumemthreads,
                                            clustercontrolplanecpumemmemory,
                                            clustercontrolplanepc,
                                            clustercontrolplanefirmware,
                                            clustercontrolplanesecureboot,
                                            clustercontrolplanereplicas,
                                            clustercontrolplanedisksize,
                                            clustercontrolplanedisksc,
                                            clustercontrolplanediskam,
                                            clustercontrolplanediskcm);

                this.createNodePoolRelatedObjects(clustername,
                                            clusternamespace,
                                            clusterversion,
                                            clusternetwork,
                                            clusternetworktype,
                                            clusterautoscaler,
                                            clusternodepoolname,
                                            clusternodepoolosdist,
                                            clusternodepoolosversion,
                                            clusternodepoolimageurl,
                                            clusternodepooltype,
                                            clusternodepoolcpumemsockets,
                                            clusternodepoolcpumemcores,
                                            clusternodepoolcpumemthreads,
                                            clusternodepoolcpumemmemory,
                                            clusternodepoolpc,
                                            clusternodepoolfirmware,
                                            clusternodepoolsecureboot,
                                            clusternodepoolreplicas,
                                            clusternodepoolminreplicas,
                                            clusternodepoolmaxreplicas,
                                            clusternodepooldisksize,
                                            clusternodepooldisksc,
                                            clusternodepooldiskam,
                                            clusternodepooldiskcm);

                this.loadCNIandFeaturesIntoCluster(clustername,
                                                   clusternamespace,
                                                   clustercni,
                                                   clustercniversion,
                                                   clustercnivxlanport,
                                                   clusterpodcidr,
                                                   clusterfeaturescertmanager,
                                                   clusterfeaturesdashboard,
                                                   clusterfeaturesmetrics,
                                                   clusterfeatureshaproxyingress,
                                                   clusterfeaturesnginxingress,
                                                   clusterfeaturestekton);

                this.loadKubevirtCloudControllerManager(clusternamespace, clustername);

                if(clusterautoscaler == "true") {
                    this.loadClusterAutoscaler(clusternamespace, clustername);
                }

                this.hideComponent("modal-newcluster");
                this.fullReload();
            } catch (e: any) {
                console.log(e);
                alert(e.error.message);
            }
        }

    }

    /*
     * Create new Standard Cluster
     */
    async applyNewClusterCustom(
        clustername: string,
        clusternamespace: string,
        clusterversion: string,
        clusterdns: string,
        clusterpodcidr: string,
        clustersvccidr: string,
        clusternetwork: string,
        clusternetworktype: string,
        clustercontrolplaneeptype: string,
        clustercontrolplanetype: string,
        clustercontrolplanecpumemsockets: string,
        clustercontrolplanecpumemcores: string,
        clustercontrolplanecpumemthreads: string,
        clustercontrolplanecpumemmemory: string,
        clustercontrolplanepc: string,
        clustercontrolplanefirmware: string,
        clustercontrolplanesecureboot: string,
        clustercontrolplanereplicas: string,
        clustercontrolplanecloudinit: string,
        clustercontrolplaneimageurl: string,
        clustercontrolplanedisksize: string,
        clustercontrolplanedisksc: string,
        clustercontrolplanediskam: string,
        clustercontrolplanediskcm: string,
        clusternodepoolname: string,
        clusternodepooltype: string,
        clusternodepoolcpumemsockets: string,
        clusternodepoolcpumemcores: string,
        clusternodepoolcpumemthreads: string,
        clusternodepoolcpumemmemory: string,
        clusternodepoolpc: string,
        clusternodepoolfirmware: string,
        clusternodepoolsecureboot: string,
        clusternodepoolreplicas: string,
        clusternodepoolcloudinit: string,
        clusternodepoolimageurl: string,
        clusternodepooldisksize: string,
        clusternodepooldisksc: string,
        clusternodepooldiskam: string,
        clusternodepooldiskcm: string
    ) {

        /* Loading control plane data needed for validation */
        let controlPlaneTypedCpus = 0;
        if(clustercontrolplanetype != "custom" && clustercontrolplanetype != "")
        {
            try {
                const data = await lastValueFrom(this.kubeVirtService.getClusterInstanceType(clustercontrolplanetype));
                controlPlaneTypedCpus = Number(data.spec.cpu["guest"]);
            } catch (e: any) {
                console.log(e);
            }
        }

        /*
         * Basic Field Validation
         */
        if(clustername == "" || clusternamespace == "") {
            alert("You need to fill in the name and namespace fields!");
        } else if(clustername.includes(this.charDot)) {
            alert("Your cluster name should not have . (dot) character!");
        } else if (clusterdns == "") {
            alert("Cluster DNS should not be empty");
        } else if (clustercontrolplaneimageurl == "") {
            alert("You must enter an URL for Control Plane Disk!");
        } else if (!clustercontrolplaneimageurl.startsWith("http")) {
            alert("Control Plane Disk URL must start with http or https");
        } else if (clusterversion == "" || clusterversion.toLowerCase() == "none") {
            alert("You need to select a Kubernetes Version for you cluster!");
        } else if (clustercontrolplaneeptype == "" || clustercontrolplaneeptype.toLowerCase() == "none") {
            alert("Please select an Endpoint Type for you Kubernetes API!");
        } else if(this.checkClusterExists(clustername, clusternamespace)) {
            alert("Cluster with name/namespace combination already exists!");
        } else if(clustercontrolplanetype.toLowerCase() == "none" || clustercontrolplanetype.toLowerCase() == "") {
            alert("Please select a valid VM Type for Control Plane!");
        } else if(clusternodepooltype.toLowerCase() == "none" || clusternodepooltype.toLowerCase() == "") {
            alert("Please select a valid VM Type for Node Pool!");
        } else if(Number(clustercontrolplanereplicas)%2 == 0 || Number(clustercontrolplanereplicas) == 0 || clustercontrolplanereplicas == "") {
            alert("Control Plane replicas number needs to be an odd number!");
        } else if(clustercontrolplanedisksize == "") {
            alert("Check Control Plane disk size!");
        } else if (clusternodepoolimageurl == "") {
            alert("You must enter an URL for Node Pool Disk!");
        } else if (!clusternodepoolimageurl.startsWith("http")) {
            alert("Node Pool Disk URL must start with http or https");
        } else if(clusternodepooldisksize == "") {
            alert("Check Node Pool disk size!");
        } else if(Number(clusternodepoolreplicas) == 0 || clusternodepoolreplicas == "") {
            alert("Please check your Node Pool replicas number!");
        } else if((clustercontrolplanetype.toLowerCase() == "custom") && (clustercontrolplanecpumemsockets == "" || clustercontrolplanecpumemcores == "" || clustercontrolplanecpumemthreads == "" || clustercontrolplanecpumemmemory == "")) {
            alert("To use Control Plane with Custom Type, you must fill in all CPU and Memory fields!");
        } else if((clusternodepooltype.toLowerCase() == "custom") && (clusternodepoolcpumemsockets == "" || clusternodepoolcpumemcores == "" || clusternodepoolcpumemthreads == "" || clusternodepoolcpumemmemory == "")) {
            alert("To use Node Pool with Custom Type, you must fill in all CPU and Memory fields!");
        } else if((clustercontrolplanetype == "custom") && ((Number(clustercontrolplanecpumemcores) * Number(clustercontrolplanecpumemsockets) * Number(clustercontrolplanecpumemthreads)) < 2 )) {
            alert("Control Plane machines needs at least 2 vCPU!");
        } else if(clustercontrolplanetype != "custom" && controlPlaneTypedCpus < 2) {
            alert("Control Plane machines needs at least 2 vCPU, choose a bigger VM Type!");
        } else if (this.validateAnnotations() && this.validateCtrlAnnotations() && this.validateLabels() && this.validateCtrlLabels()) {

            /* Auto Fill CIDR Blocks */
            if(clusterpodcidr == "") {
                clusterpodcidr = "10.243.0.0/16";
            }
            if(clustersvccidr == "") {
                clustersvccidr = "10.95.0.0/16";
            }

            let clustercontrolplaneosdist = "custom";
            let clustercontrolplaneosversion = "custom";
            if (clustercontrolplanecloudinit == "ignition") {
                clustercontrolplaneosdist = "flatcar"
            }
            
            let clusternodepoolosdist = "custom";
            let clusternodepoolosversion = "custom";
            if (clusternodepoolcloudinit == "ignition") {
                clusternodepoolosdist = "flatcar"
            }

            /* Generate random VXLAN Port */
            let clustercnivxlanport = "0000";
            let clustercni = "manual";
            let clustercniversion = "manual";

            /* Create Cluster Related Objects */
            try {
                this.createClusterRelatedObjects(clustername,
                                            clusternamespace,
                                            clustercni,
                                            clustercniversion,
                                            clustercnivxlanport,
                                            clusterpodcidr,
                                            clustersvccidr,
                                            "false",
                                            clustercontrolplaneeptype);

                this.createControlPlaneRelatedObjects(clustername,
                                            clusternamespace,
                                            clusterversion,
                                            clusterdns,
                                            clusterpodcidr,
                                            clustersvccidr,
                                            clusternetwork,
                                            clusternetworktype,
                                            clustercontrolplaneosdist,
                                            clustercontrolplaneosversion,
                                            clustercontrolplaneimageurl,
                                            clustercontrolplanetype,
                                            clustercontrolplanecpumemsockets,
                                            clustercontrolplanecpumemcores,
                                            clustercontrolplanecpumemthreads,
                                            clustercontrolplanecpumemmemory,
                                            clustercontrolplanepc,
                                            clustercontrolplanefirmware,
                                            clustercontrolplanesecureboot,
                                            clustercontrolplanereplicas,
                                            clustercontrolplanedisksize,
                                            clustercontrolplanedisksc,
                                            clustercontrolplanediskam,
                                            clustercontrolplanediskcm);

                this.createNodePoolRelatedObjects(clustername,
                                            clusternamespace,
                                            clusterversion,
                                            clusternetwork,
                                            clusternetworktype,
                                            "false",
                                            clusternodepoolname,
                                            clusternodepoolosdist,
                                            clusternodepoolosversion,
                                            clusternodepoolimageurl,
                                            clusternodepooltype,
                                            clusternodepoolcpumemsockets,
                                            clusternodepoolcpumemcores,
                                            clusternodepoolcpumemthreads,
                                            clusternodepoolcpumemmemory,
                                            clusternodepoolpc,
                                            clusternodepoolfirmware, 
                                            clusternodepoolsecureboot,
                                            clusternodepoolreplicas,
                                            "0",
                                            "0",
                                            clusternodepooldisksize,
                                            clusternodepooldisksc,
                                            clusternodepooldiskam,
                                            clusternodepooldiskcm);

                /* Custom cluster doesn't support CNI and Features so far */

                this.loadKubevirtCloudControllerManager(clusternamespace, clustername);

                this.hideComponent("modal-newclustercustom");
                this.fullReload();
            } catch (e: any) {
                console.log(e);
                alert(e.error.message);
            }
        }

    }

    /*
     * Create Cluster Objects
     */
    async createClusterRelatedObjects(
        name: string,
        namespace: string,
        cni: string,
        cniversion: string,
        clustercnivxlanport: string,
        podcidr: string,
        svccidr: string,
        clusterautoscaler: string,
        controlplaneeptype: string
    ) {

        /* Load Custom Labels OPTIONAL */
        let labelsForm = this.getLabels();
        let tmpLabels = {};
        let tmpctrlLabels = {};
        for (let i = 0; i < labelsForm.length; i++) {
            let thisLabel = {
                [labelsForm[i].labelKey.toString()] : labelsForm[i].labelValue
            };
            Object.assign(tmpLabels, thisLabel);
            Object.assign(tmpctrlLabels, thisLabel)
        }

        /* Load Annotations OPTIONAL */
        let annotationsForm = this.getAnnotations();
        let tmpAnnotations = {};
        for (let i = 0; i < annotationsForm.length; i++) {
            let thisAnnotation = {
                [annotationsForm[i].annotKey.toString()] : annotationsForm[i].annotValue
            };
            Object.assign(tmpAnnotations, thisAnnotation);
        }

        /* Load Control Plane Labels OPTIONAL */
        let ctrlLabelsForm = this.getCtrlLabels();
        for (let i = 0; i < ctrlLabelsForm.length; i++) {
            let thisLabel = {
                [ctrlLabelsForm[i].ctrlLabelKey.toString()] : ctrlLabelsForm[i].ctrlLabelValue
            };
            Object.assign(tmpctrlLabels, thisLabel);
        }

        /* Load Control Plane Annotations OPTIONAL */
        let ctrlAnnotationsForm = this.getCtrlAnnotations();
        let tmpctrlAnnotations = {};
        for (let i = 0; i < ctrlAnnotationsForm.length; i++) {
            let thisAnnotation = {
                [ctrlAnnotationsForm[i].ctrlAnnotKey.toString()] : ctrlAnnotationsForm[i].ctrlAnnotValue
            };
            Object.assign(tmpctrlAnnotations, thisAnnotation);
        }

        /* Load other labels */
        let clusterNameLabel = { [this.myConstants.KubevirtManagerCluster]: name };
        Object.assign(tmpLabels, clusterNameLabel);
        Object.assign(tmpctrlLabels, clusterNameLabel);

        let kubevirtManagerLabel = { [this.myConstants.KubevirtManagerManaged]: "true" };
        Object.assign(tmpLabels, kubevirtManagerLabel);
        Object.assign(tmpctrlLabels, kubevirtManagerLabel);

        let clusterAutoscalerLabel = { [this.myConstants.KubevirtManagerClusterAutoscaler]: clusterautoscaler };
        Object.assign(tmpLabels, clusterAutoscalerLabel);

        if(cni.toLowerCase() != "manual") {

            let thisCNILabel = { [this.myConstants.KubevirtManagerClusterCni]: cni };
            Object.assign(tmpLabels, thisCNILabel);

            let thisCNIVersionLabel = { [this.myConstants.KubevirtManagerClusterCniVersion]: cniversion };
            Object.assign(tmpLabels, thisCNIVersionLabel);

            let thisCNIVXLANPortLabel = { [this.myConstants.KubevirtManagerClusterCniPort]: clustercnivxlanport };
            Object.assign(tmpLabels, thisCNIVXLANPortLabel);
        }


        /* Creating our Objects */
        let cluster: Cluster = {
            apiVersion: "cluster.x-k8s.io/v1beta1",
            kind: "Cluster",
            metadata: {
                name: name,
                namespace: namespace,
            },
            spec: {
                clusterNetwork: {
                    pods: {
                        cidrBlocks: [ podcidr ]
                    },
                    services: {
                        cidrBlocks: [ svccidr ]
                    },
                },
                controlPlaneRef: {
                    apiVersion: "controlplane.cluster.x-k8s.io/v1beta1",
                    kind: "KubeadmControlPlane",
                    name: name + "-control-plane",
                    namespace: namespace
                },
                infrastructureRef: {
                    apiVersion: "infrastructure.cluster.x-k8s.io/v1alpha1",
                    kind: "KubevirtCluster",
                    name: name,
                    namespace: namespace
                }
            }
        };
        let kubevirtCluster: KubevirtCluster = {
            apiVersion: "infrastructure.cluster.x-k8s.io/v1alpha1",
            kind: "KubevirtCluster",
            metadata: {
                name: name,
                namespace: namespace,
            },
            spec: {
                controlPlaneServiceTemplate: {
                    metadata: {},
                    spec: {
                        type: controlplaneeptype,
                        externalTrafficPolicy: "Cluster"
                    }
                }
            }
        };

        /* Assigning Labels and Annotations */
        Object.assign(tmpLabels, { [this.firewallLabels.Cluster]: name });
        cluster.metadata.labels = tmpLabels;
        kubevirtCluster.metadata.labels = tmpLabels;
        kubevirtCluster.metadata.annotations = tmpAnnotations;
        kubevirtCluster.spec.controlPlaneServiceTemplate.metadata.labels = tmpctrlLabels;
        kubevirtCluster.spec.controlPlaneServiceTemplate.metadata.annotations = tmpctrlAnnotations;

        try {
            let data = await lastValueFrom(this.xK8sService.createCluster(cluster));
            data = await lastValueFrom(this.xK8sService.createKubevirtCluster(kubevirtCluster));
        } catch (e: any) {
            console.log(e);
            alert(e.error.message);
        }

    }

    /*
     * Create Control Plane Objects
     */
    async createControlPlaneRelatedObjects(
        name: string,
        namespace: string,
        version: string,
        dns: string,
        podcidr: string,
        svccidr: string,
        network: string,
        networktype: string,
        controlplaneosdist: string,
        controlplaneosversion: string,
        controlplaneosimageurl: string,
        controlplanetype: string,
        controlplanecpumemsockets: string,
        controlplanecpumemcores: string,
        controlplanecpumemthreads: string,
        controlplanecpumemmemory: string,
        controlplanepc: string,
        controlplanefirmware: string,
        controlplanesecureboot: string,
        controlplanereplicas: string,
        controlplanedisksize: string,
        controlplanedisksc: string,
        controlplanediskam: string,
        controlplanediskcm: string,
    ) {
        /* Custom Labels */
        let tmpLabels = {};
        let labelsForm = this.getLabels();
        for (let i = 0; i < labelsForm.length; i++) {
            let thisLabel = {
                [labelsForm[i].labelKey.toString()] : labelsForm[i].labelValue
            };
            Object.assign(tmpLabels, thisLabel);
        }
        let machineTemplateLabels = {};
        Object.assign(machineTemplateLabels, tmpLabels);

        /* Load other labels */
        let clusterNameLabel = { [this.myConstants.KubevirtManagerCluster]: name };
        Object.assign(tmpLabels, clusterNameLabel);
        Object.assign(machineTemplateLabels, clusterNameLabel);

        let kubevirtManagerLabel = { [this.myConstants.KubevirtManagerManaged]: "true" };
        Object.assign(tmpLabels, kubevirtManagerLabel);

        /* Load Annotations OPTIONAL */
        let annotationsForm = this.getAnnotations();
        let tmpAnnotations = {};
        for (let i = 0; i < annotationsForm.length; i++) {
            let thisAnnotation = {
                [annotationsForm[i].annotKey.toString()] : annotationsForm[i].annotValue
            };
            Object.assign(tmpAnnotations, thisAnnotation);
        }

        
        /* Machine Labels */
        Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerCluster]: name });
        Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerManaged]: "true" });
        Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerClusterFlavor]: controlplaneosdist });
        Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerClusterFlavorVersion]: controlplaneosversion });
        Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerClusterKubernetesVersion] : version });
        Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtDomain]: name + "-control-plane" });
        Object.assign(machineTemplateLabels, { [this.firewallLabels.Cluster]: name });
        Object.assign(machineTemplateLabels, { [this.firewallLabels.ClusterMasterPool]: name + "-control-plane" });

        /* KubeadmControlPlane */
        let kubeadmControlPlane: KubeadmControlPlane = {
            apiVersion: "controlplane.cluster.x-k8s.io/v1beta1",
            kind: "KubeadmControlPlane",
            metadata: {
                name: name + "-control-plane",
                namespace: namespace
            },
            spec: {
                kubeadmConfigSpec: {
                    clusterConfiguration: {
                        networking: {
                            dnsDomain: dns,
                            podSubnet: podcidr,
                            serviceSubnet: svccidr
                        }
                    },
                    initConfiguration: {
                        nodeRegistration: {
                            criSocket: "/var/run/containerd/containerd.sock"
                        }
                    },
                    joinConfiguration: {
                        nodeRegistration: {
                            criSocket: "/var/run/containerd/containerd.sock"
                        }
                    },
                    useExperimentalRetryJoin: true,
                    format: "cloud-config"
                },
                machineTemplate: {
                    infrastructureRef: {
                        apiVersion: "infrastructure.cluster.x-k8s.io/v1alpha1",
                        kind: "KubevirtMachineTemplate",
                        name: name + "-control-plane",
                        namespace: namespace
                    }
                },
                replicas: Number(controlplanereplicas),
                version: version
            }
        };
        kubeadmControlPlane.metadata.labels = tmpLabels;
        kubeadmControlPlane.metadata.annotations = tmpAnnotations;

        /* Add ignition support for flatcar */
        if (controlplaneosdist == "flatcar") {
            let ignition = { containerLinuxConfig: { additionalConfig: "systemd:\n  units:\n  - name: kubeadm.service\n    enabled: true\n    dropins:\n    - name: 10-flatcar.conf\n      contents: |\n        [Unit]\n        Requires=containerd.service\n        After=containerd.service\n" }};
            kubeadmControlPlane.spec.kubeadmConfigSpec.format = "ignition";
            kubeadmControlPlane.spec.kubeadmConfigSpec.ignition = ignition;
            kubeadmControlPlane.spec.kubeadmConfigSpec.useExperimentalRetryJoin = false;
        }

        /* 
         * Kubevirt Machine Template
         */
        let kubevirtMachineTemplate: KubevirtMachineTemplate = {
            apiVersion: "infrastructure.cluster.x-k8s.io/v1alpha1",
            kind: "KubevirtMachineTemplate",
            metadata: {
                name: name + "-control-plane",
                namespace: namespace,
                labels: machineTemplateLabels,
                annotations: tmpAnnotations
            },
            spec: {
                template: {
                    spec: {
                        virtualMachineTemplate: {
                            metadata: {
                                namespace: namespace,
                                labels: machineTemplateLabels,
                                annotations: tmpAnnotations
                            },
                            spec: {
                                dataVolumeTemplates: {},
                                runStrategy: "Once",
                                template: {
                                    metadata: {
                                        labels: machineTemplateLabels,
                                        annotations: tmpAnnotations
                                    },
                                    spec: {
                                        priorityClassName: controlplanepc,
                                        domain: {
                                            devices: {
                                                disks: {},
                                                interfaces: {},
                                                networkInterfaceMultiqueue: true,
                                            },
                                        },
                                        networks: {},
                                        volumes: {},
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
        
        /* Check Control Plane VM Type */
        if(controlplanetype.toLowerCase() == "custom") {
            /* Custom VM */
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.cpu = {
                cores: Number(controlplanecpumemcores),
                threads: Number(controlplanecpumemthreads),
                sockets: Number(controlplanecpumemsockets)                                
            };
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.resources = {
                requests: {
                    memory: controlplanecpumemmemory + "Gi"
                }
            };
        } else {
            /* Typed VM */
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.instancetype = {
                kind: "VirtualMachineClusterInstancetype",
                name: controlplanetype
            };
        }

        /* Firmware and Secure Boot */
        /* if(controlplanefirmware.toLowerCase() == "bios") {
            let firmware = { 'bootloader': { 'bios': {}}};
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.firmware = firmware;
        } else if (controlplanefirmware.toLowerCase() == "uefi") {
            let firmware = {};
            if(controlplanesecureboot == "true") {
                firmware = { 'bootloader': { 'efi': { 'secureBoot': true }}};
            } else {
                firmware = { 'bootloader': { 'efi': { 'secureBoot': false }}};
            }
            let features = { 'smm': { 'enabled': true }};
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.firmware = firmware;
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.features = features;
        } else {
            let firmware = { 'bootloader': { 'bios': {}}};
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.firmware = firmware;
        } */

        /* Placeholders */
        let devices = [];
        let disks = [];
        let dvtemplates = [];
        let networks = [];
        let interfaces = [];

        /* Create Disk From Image */
        let disk1 = {};
        let device1 = {};
        let disk1name = "disk1";
        let disk1dv: DataVolume = {
            apiVersion: "cdi.kubevirt.io/v1beta1",
            kind: "DataVolume",
            metadata: {
                name: disk1name,
                namespace: namespace,
                labels: tmpLabels,
                annotations: {
                    "cdi.kubevirt.io/storage.deleteAfterCompletion": "false"
                },
            },
            spec: {
                pvc: {
                    storageClassName: controlplanedisksc,
                    accessModes: [ controlplanediskam ],
                    resources: {
                        requests: {
                            storage: controlplanedisksize + "Gi"
                        }
                    }
                },
                source: {
                    http: {
                        url: controlplaneosimageurl
                    }
                }
            }
        };
        

        if(controlplanediskcm != "") {
            disk1 = { 'name': "disk1", 'cache': controlplanediskcm, 'disk': {} };
        } else {
            disk1 = { 'name': "disk1", 'disk': {} };
        }
        device1 = { 'name': "disk1", 'dataVolume': { 'name': disk1name } }

        dvtemplates.push(disk1dv);
        devices.push(device1);
        disks.push(disk1);

        /* Network Setup */
        let net1 = {};
        let iface1 = {};
        if(network != "podNetwork") {
            net1 = { 'name': "net1", 'multus': {'networkName': network } };
        } else {
            net1 = { 'name': "net1", 'pod': {} };
        }
        if(networktype == "bridge") {
            iface1 = { 'name': "net1", 'bridge': {} };
        } else {
            iface1 = { 'name': "net1", 'masquerade': {} };
        }

        networks.push(net1);
        interfaces.push(iface1);

        /* Disk Setup */
        if(disks.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.devices.disks = disks; }
        if(devices.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.volumes = devices; }
        if(dvtemplates.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.dataVolumeTemplates = dvtemplates; }

        /* Net Setup */
        if(interfaces.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.devices.interfaces = interfaces; }
        if(networks.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.networks = networks; }

        try {
            let data = await lastValueFrom(this.xK8sService.createKubeadmControlPlane(kubeadmControlPlane));
            data = await lastValueFrom(this.xK8sService.createKubevirtMachineTemplate(kubevirtMachineTemplate));
        } catch (e: any) {
            alert(e.error.message);
            console.log(e);
        }
    }

     /*
     * Create Node Pool Objects
     */
     async createNodePoolRelatedObjects(
        name: string,
        namespace: string,
        version: string,
        network: string,
        networktype: string,
        clusterautoscaler: string,
        nodepoolname: string,
        nodepoolosdist: string,
        nodepoolosversion: string,
        nodepoolosimageurl: string,
        nodepooltype: string,
        nodepoolcpumemsockets: string,
        nodepoolcpumemcores: string,
        nodepoolcpumemthreads: string,
        nodepoolcpumemmemory: string,
        nodepoolpc: string,
        nodepoolfirmware: string,
        nodepoolsecureboot: string,
        nodepoolreplicas: string,
        nodepoolminreplicas: string,
        nodepoolmaxreplicas: string,
        nodepooldisksize: string,
        nodepooldisksc: string,
        nodepooldiskam: string,
        nodepooldiskcm: string,
    ) {
        /* Custom Labels */
        let tmpLabels = {};
        let labelsForm = this.getLabels();
        for (let i = 0; i < labelsForm.length; i++) {
            let thisLabel = {
                [labelsForm[i].labelKey.toString()] : labelsForm[i].labelValue
            };
            Object.assign(tmpLabels, thisLabel);
        }
        let machineDeploymentLabels = {};
        Object.assign(machineDeploymentLabels, tmpLabels);

        /* Load Annotations OPTIONAL */
        let annotationsForm = this.getAnnotations();
        let tmpAnnotations = {};
        for (let i = 0; i < annotationsForm.length; i++) {
            let thisAnnotation = {
                [annotationsForm[i].annotKey.toString()] : annotationsForm[i].annotValue
            };
            Object.assign(tmpAnnotations, thisAnnotation);
        }

        let machineDeploymentAnnotations = {};
        Object.assign(machineDeploymentAnnotations, tmpAnnotations);
        let machineTemplateLabels = {};

        /* KubeadmConfig Labe;s */
        Object.assign(tmpLabels, { [this.myConstants.KubevirtManagerCluster]: name });
        Object.assign(tmpLabels, { [this.myConstants.KubevirtManagerManaged]: "true" });

        /* MachineDeployment Labels */
        Object.assign(machineDeploymentLabels, { [this.myConstants.KubevirtManagerCluster]: name });
        Object.assign(machineDeploymentLabels, { [this.myConstants.KubevirtManagerManaged]: "true" });
        Object.assign(machineDeploymentLabels, { [this.myConstants.KubevirtManagerClusterAutoscaler]: clusterautoscaler });

        /* MachineDeployment Annotations */
        if(clusterautoscaler == "true") {
            Object.assign(machineDeploymentAnnotations, { [this.myConstants.KubevirtManagerClusterAutoscalerMin]: nodepoolminreplicas });
            Object.assign(machineDeploymentAnnotations, { [this.myConstants.KubevirtManagerClusterAutoscalerMax]: nodepoolmaxreplicas });
        }
        
        /* Machine Labels */
        Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerCluster]: name });
        Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerManaged]: "true" });
        Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerClusterFlavor]: nodepoolosdist });
        Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerClusterFlavorVersion]: nodepoolosversion });
        Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtManagerClusterKubernetesVersion]: version });
        Object.assign(machineTemplateLabels, { [this.myConstants.KubevirtDomain]: name + "-" + nodepoolname });
        Object.assign(machineTemplateLabels, { [this.firewallLabels.Cluster]: name });
        Object.assign(machineTemplateLabels, { [this.firewallLabels.ClusterWorkerPool]: name + "-" + nodepoolname });


        /* KubeadmConfig */
        let kubeadmConfigTemplate: KubeadmConfigTemplate = {
            apiVersion: "bootstrap.cluster.x-k8s.io/v1beta1",
            kind: "KubeadmConfigTemplate",
            metadata: {
                name: name + "-" + nodepoolname,
                namespace: namespace,
                labels: tmpLabels,
                annotations: tmpAnnotations
            },
            spec: {
                template: {
                    metadata: {
                        labels: tmpLabels,
                        annotations: tmpAnnotations
                    },
                    spec: {
                        joinConfiguration: {
                            nodeRegistration: {
                                kubeletExtraArgs: {}
                            }
                        },
                        useExperimentalRetryJoin: true,
                        format: "cloud-config"
                    }
                }
            }
        }

        /* Add ignition support for flatcar */
        if (nodepoolosdist == "flatcar") {
            let ignition = { containerLinuxConfig: { additionalConfig: "systemd:\n  units:\n  - name: kubeadm.service\n    enabled: true\n    dropins:\n    - name: 10-flatcar.conf\n      contents: |\n        [Unit]\n        Requires=containerd.service\n        After=containerd.service\n" }};
            kubeadmConfigTemplate.spec.template.spec.format = "ignition";
            kubeadmConfigTemplate.spec.template.spec.ignition = ignition;
            kubeadmConfigTemplate.spec.template.spec.useExperimentalRetryJoin = false;
        }

        /* MachineDeployment */
        let machineDeployment: MachineDeployment = {
            apiVersion: "cluster.x-k8s.io/v1beta1",
            kind: "MachineDeployment",
            metadata: {
                name: name + "-" + nodepoolname,
                namespace: namespace,
                annotations: machineDeploymentAnnotations,
                labels: machineDeploymentLabels
            },
            spec: {
                clusterName: name,
                replicas: Number(nodepoolreplicas),
                selector: {},
                template: {
                    metadata: {
                        labels: machineDeploymentLabels,
                        annotations: tmpAnnotations
                    },
                    spec: {
                        bootstrap: {
                            configRef: {
                                apiVersion: "bootstrap.cluster.x-k8s.io/v1beta1",
                                kind: "KubeadmConfigTemplate",
                                name: name + "-" + nodepoolname,
                                namespace: namespace
                            }
                        },
                        clusterName: name,
                        infrastructureRef: {
                            apiVersion: "infrastructure.cluster.x-k8s.io/v1alpha1",
                            kind: "KubevirtMachineTemplate",
                            name: name + "-" + nodepoolname,
                            namespace: namespace
                        },
                        version: version
                    }
                }
            }
        }

        /* 
         * Kubevirt Machine Template
         */
        let kubevirtMachineTemplate: KubevirtMachineTemplate = {
            apiVersion: "infrastructure.cluster.x-k8s.io/v1alpha1",
            kind: "KubevirtMachineTemplate",
            metadata: {
                name: name + "-" + nodepoolname,
                namespace: namespace,
                labels: machineTemplateLabels,
                annotations: tmpAnnotations
            },
            spec: {
                template: {
                    spec: {
                        virtualMachineTemplate: {
                            metadata: {
                                namespace: namespace,
                                labels: machineTemplateLabels,
                                annotations: tmpAnnotations
                            },
                            spec: {
                                dataVolumeTemplates: {},
                                runStrategy: "Once",
                                template: {
                                    metadata: {
                                        labels: machineTemplateLabels,
                                        annotations: tmpAnnotations
                                    },
                                    spec: {
                                        priorityClassName: nodepoolpc,
                                        domain: {
                                            devices: {
                                                disks: {},
                                                interfaces: {},
                                                networkInterfaceMultiqueue: true
                                            }
                                        },
                                        networks: {},
                                        volumes: {}
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        /* Check Node Pool VM Type */
        if(nodepooltype.toLowerCase() == "custom") {
            /* Custom VM */
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.cpu = {
                cores: Number(nodepoolcpumemcores),
                threads: Number(nodepoolcpumemthreads),
                sockets: Number(nodepoolcpumemsockets)
            };
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.resources = {
                requests: {
                    memory: nodepoolcpumemmemory + "Gi"
                }
            };
        } else {
            /* Typed VM */
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.instancetype = {
                kind: "VirtualMachineClusterInstancetype",
                name: nodepooltype
            };

        }

        /* Firmware and Secure Boot */
        /* if(nodepoolfirmware.toLowerCase() == "bios") {
            let firmware = { 'bootloader': { 'bios': {}}};
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.firmware = firmware;
        } else if (nodepoolfirmware.toLowerCase() == "uefi") {
            let firmware = {};
            if(nodepoolsecureboot == "true") {
                firmware = { 'bootloader': { 'efi': { 'secureBoot': true }}};
            } else {
                firmware = { 'bootloader': { 'efi': { 'secureBoot': false }}};
            }
            let features = { 'smm': { 'enabled': true }};
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.firmware = firmware;
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.features = features;
        } else {
            let firmware = { 'bootloader': { 'bios': {}}};
            kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.firmware = firmware;
        } */

        /* Placeholders */
        let devices = [];
        let disks = [];
        let dvtemplates = [];
        let networks = [];
        let interfaces = [];

        /* Create Disk From Image */
        let disk1 = {};
        let device1 = {};
        let disk1name = "disk1";
        let disk1dv: DataVolume = {
            apiVersion: "cdi.kubevirt.io/v1beta1",
            kind: "DataVolume",
            metadata: {
                name: disk1name,
                namespace: namespace,
                labels: tmpLabels,
                annotations: {
                    "cdi.kubevirt.io/storage.deleteAfterCompletion": "false"
                }
            },
            spec: {
                pvc: {
                    storageClassName: nodepooldisksc,
                    accessModes: [ nodepooldiskam ],
                    resources: {
                        requests: {
                            storage: nodepooldisksize + "Gi"
                        }
                    }
                },
                source: {
                    http: {
                        url: nodepoolosimageurl
                    }
                }
            }
        }
        dvtemplates.push(disk1dv);
        if(nodepooldiskcm != "") {
            disk1 = { 'name': "disk1", 'cache': nodepooldiskcm, 'disk': {} };
        } else {
            disk1 = { 'name': "disk1", 'disk': {} };
        }
        device1 = { 'name': "disk1", 'dataVolume': { 'name': disk1name } };
        devices.push(device1);
        disks.push(disk1);

        /* Network Setup */
        let net1 = {};
        let iface1 = {};
        if(network != "podNetwork") {
            net1 = { 'name': "net1", 'multus': {'networkName': network } };
        } else {
            net1 = { 'name': "net1", 'pod': {} };
        }
        if(networktype == "bridge") {
            iface1 = { 'name': "net1", 'bridge': {} };
        } else {
            iface1 = { 'name': "net1", 'masquerade': {} };
        }
        networks.push(net1);
        interfaces.push(iface1);

        /* Disk Setup */
        if(disks.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.devices.disks = disks; }
        if(devices.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.volumes = devices; }
        if(dvtemplates.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.dataVolumeTemplates = dvtemplates; }

        /* Net Setup */
        if(interfaces.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.devices.interfaces = interfaces; }
        if(networks.length > 0) { kubevirtMachineTemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.networks = networks; }


        try {
            let data = await lastValueFrom(this.xK8sService.createKubevirtMachineTemplate(kubevirtMachineTemplate));
            data = await lastValueFrom(this.xK8sService.createKubeadmConfigTemplate(kubeadmConfigTemplate));
            data = await lastValueFrom(this.xK8sService.createMachineDeployment(machineDeployment));
        } catch (e: any) {
            console.log(e);
            alert(e.error.message);
        }
    }

    /*
     * Load Secret with Cluster Objects and CNI
     */
    async loadCNIandFeaturesIntoCluster(clustername: string,
        clusternamespace: string,
        clustercni: string,
        clustercniversion: string,
        clustercnivxlanport: string,
        clusterpodcidr: string,
        clusterfeaturescertmanager: boolean,
        clusterfeaturesdashboard: boolean,
        clusterfeaturesmetrics: boolean,
        clusterfeatureshaproxyingress: boolean,
        clusterfeaturesnginxingress: boolean,
        clusterfeaturestekton: boolean
        ) {
            let secretData = {};
            let checkData = false;
            /* Load Custom Labels OPTIONAL */
            let labelsForm = this.getLabels();
            let tmpLabels = {};
            for (let i = 0; i < labelsForm.length; i++) {
                let thisLabel = {
                    [labelsForm[i].labelKey.toString()] : labelsForm[i].labelValue
                };
                Object.assign(tmpLabels, thisLabel);
            }

            /* Load other labels */

            let thisLabel = { [this.myConstants.KubevirtManagerCluster]: clustername };
            Object.assign(tmpLabels, thisLabel);

            let kubevirtManagerLabel = { [this.myConstants.KubevirtManagerManaged]: "true" };
            Object.assign(tmpLabels, kubevirtManagerLabel);

            if(clustercni.toLowerCase() != "manual") {

                checkData = true;
                let thisCNILabel = { [this.myConstants.KubevirtManagerClusterCni]: clustercni };
                Object.assign(tmpLabels, thisCNILabel);

                let thisCNIVersionLabel = { [this.myConstants.KubevirtManagerClusterCniVersion]: clustercniversion };
                Object.assign(tmpLabels, thisCNIVersionLabel);

                let thisCNIVXLANPortLabel = { [this.myConstants.KubevirtManagerClusterCniPort]: clustercnivxlanport };
                Object.assign(tmpLabels, thisCNIVXLANPortLabel);


                let cniBase64 = await this.generateCNIBase64(this.getCNIUrl(clustercni, clustercniversion), clusterpodcidr, clustercnivxlanport);

                Object.assign(secretData, { 'cni.yaml' : cniBase64.toString() });
            }

            if(clusterfeaturescertmanager) {
                for(let i = 0; i < this.featureList.features.length; i++) {
                    let thisFeature = this.featureList.features[i];
                    if(thisFeature.id == "certmanager") {
                        let thisFeatureBase64 = await this.generateBase64(thisFeature.filename);
                        Object.assign(secretData, { 'cert-manager.yaml' : thisFeatureBase64 });
                        checkData = true;
                    }
                }
            }

            if(clusterfeaturesdashboard) {
                for(let i = 0; i < this.featureList.features.length; i++) {
                    let thisFeature = this.featureList.features[i];
                    if(thisFeature.id == "dashboard") {
                        let thisFeatureBase64 = await this.generateBase64(thisFeature.filename);
                        Object.assign(secretData, { 'dashboard.yaml' : thisFeatureBase64 });
                        checkData = true;
                    }
                }
            }

            if(clusterfeaturesmetrics) {
                for(let i = 0; i < this.featureList.features.length; i++) {
                    let thisFeature = this.featureList.features[i];
                    if(thisFeature.id == "metrics") {
                        let thisFeatureBase64 = await this.generateBase64(thisFeature.filename);
                        Object.assign(secretData, { 'metrics.yaml' : thisFeatureBase64 });
                        checkData = true;
                    }
                }
            }

            if(clusterfeatureshaproxyingress) {
                for(let i = 0; i < this.featureList.features.length; i++) {
                    let thisFeature = this.featureList.features[i];
                    if(thisFeature.id == "haproxy-ingress") {
                        let thisFeatureBase64 = await this.generateBase64(thisFeature.filename);
                        Object.assign(secretData, { 'haproxy-ingress.yaml' : thisFeatureBase64 });
                        checkData = true;
                    }
                }
            }

            if(clusterfeaturesnginxingress) {
                for(let i = 0; i < this.featureList.features.length; i++) {
                    let thisFeature = this.featureList.features[i];
                    if(thisFeature.id == "nginx-ingress") {
                        let thisFeatureBase64 = await this.generateBase64(thisFeature.filename);
                        Object.assign(secretData, { 'nginx-ingress.yaml' : thisFeatureBase64 });
                        checkData = true;
                    }
                }
            }

            if(clusterfeaturestekton) {
                for(let i = 0; i < this.featureList.features.length; i++) {
                    let thisFeature = this.featureList.features[i];
                    if(thisFeature.id == "tekton") {
                        let thisFeatureBase64 = await this.generateBase64(thisFeature.filename);
                        Object.assign(secretData, { 'tekton.yaml' : thisFeatureBase64 });
                        checkData = true;
                    }
                }
            }

            if(checkData) {
                let clusterSecret: Secret = {
                    apiVersion: "v1",
                    kind: "Secret",
                    type: "addons.cluster.x-k8s.io/resource-set",
                    metadata: {
                        name: clustername + "-config",
                        namespace: clusternamespace
                    },
                    data: secretData
                }

                let clusterResourceSet: ClusterResourceSet = {
                    apiVersion: "addons.cluster.x-k8s.io/v1beta1",
                    kind: "ClusterResourceSet",
                    metadata: {
                        name: clustername,
                        namespace: clusternamespace
                    },
                    spec: {
                        clusterSelector: {
                            matchLabels: {
                                [this.myConstants.KubevirtManagerCluster]: clustername,
                                [this.myConstants.KubevirtManagerClusterCni]: clustercni,
                            }
                        },
                        resources: [
                            {
                                kind: "Secret",
                                name: clustername + "-config",
                                namespace: clusternamespace
                            }
                        ]
                    }
                };

                try {
                    let data = await lastValueFrom(this.k8sService.createSecret(clusterSecret));
                    data = await lastValueFrom(this.xK8sService.createClusterResourseSet(clusterResourceSet));
                } catch (e: any) {
                    console.log(e);
                }
            }

        } 

    /*
     * Create Kubevirt Cloud Controller 
     */
    async loadKubevirtCloudControllerManager(namespace: string, name: string): Promise<void> {
        /* Load Custom Labels OPTIONAL */
        let labelsForm = this.getLabels();
        let tmpLabels = {};
        for (let i = 0; i < labelsForm.length; i++) {
            let thisLabel = {
                [labelsForm[i].labelKey.toString()] : labelsForm[i].labelValue
            };
            Object.assign(tmpLabels, thisLabel);
        }

        /* Load labels */
        let thisLabel = { [this.myConstants.KubevirtManagerCluster]: name };
        Object.assign(tmpLabels, thisLabel);
        let kubevirtManagerLabel = { [this.myConstants.KubevirtManagerManaged]: "true" };
        Object.assign(tmpLabels, kubevirtManagerLabel);
        Object.assign(tmpLabels, { [this.myConstants.KubernetesClusterName]: name });
        Object.assign(tmpLabels, { [this.myConstants.KubernetesCapkTemplateKind]: "extra-resource" });

        /* Service Account */
        let serviceAccount: ServiceAccount = {
            apiVersion: "v1",
            kind: "ServiceAccount",
            metadata: {
                name: name + "-kcc",
                namespace: namespace,
                labels: tmpLabels
            }
        };

        /* Role Binding */
        let roleBinding: RoleBinding = {
            apiVersion: "rbac.authorization.k8s.io/v1",
            kind: "RoleBinding",
            metadata: {
                name: name + "-kcc",
                namespace: namespace,
                labels: tmpLabels
            },
            roleRef: {
                apiGroup: "rbac.authorization.k8s.io",
                kind: "ClusterRole",
                name: "kubevirt-manager-kccm"
            },
            subjects: [{
                kind: "ServiceAccount",
                name: name + "-kcc",
                namespace: namespace
            }]
        }

        /* controller config */
        let configData = {
            "cloud-config": ""
        };
        configData['cloud-config']  = "loadBalancer:\n";
        configData['cloud-config'] += "  creationPollInterval: 30\n";
        configData['cloud-config'] += "namespace: " + namespace + "\n";
        configData['cloud-config'] += "infraLabels:\n";
        configData['cloud-config'] += "  kubevirt-manager.io/managed: \"true\"\n";
        configData['cloud-config'] += "instancesV2:\n";
        configData['cloud-config'] += "  enabled: true\n";
        configData['cloud-config'] += "  zoneAndRegionEnabled: false\n";

        /* Config Map */
        let configMap: ConfigMap = {
            apiVersion: "v1",
            kind: "ConfigMap",
            metadata: {
                name: name + "-kcc",
                namespace: namespace,
                labels: tmpLabels
            },
            data: configData
        }

        /* Controller */
        let controllerLabels = tmpLabels;
        Object.assign(controllerLabels, { 'app': "kubevirt-cloud-controller-manager" });

        /* Container spec */
        let controllerContainer = {
            name: "kubevirt-cloud-controller-manager",
            image: "quay.io/kubevirt/kubevirt-cloud-controller-manager:main",
            args: [
                "--cloud-provider=kubevirt",
                "--cloud-config=/etc/cloud/cloud-config",
                "--kubeconfig=/etc/kubernetes/kubeconfig/value",
                "--cluster-name=" + name,
                "--authentication-skip-lookup=true"
            ],
            command: ["/bin/kubevirt-cloud-controller-manager"],
            imagePullPolicy: "Always",
            resources: {
                requests: {
                    cpu: "200m"
                }
            },
            securityContext: {
                privileged: true
            },
            volumeMounts: [
                {
                    mountPath: "/etc/kubernetes/kubeconfig",
                    name: "kubeconfig",
                    readOnly: true
                },
                {
                    mountPath: "/etc/cloud",
                    name: "cloud-config",
                    readOnly: true
                }
            ]
        }

        /* Deployment spec */
        let controllerDeployment: Deployment = {
            apiVersion: "apps/v1",
            kind: "Deployment",
            metadata: {
                name: name + "-kcc",
                namespace: namespace,
                labels: controllerLabels
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: controllerLabels
                },
                template: {
                    metadata: {
                        labels: controllerLabels
                    },
                    spec: {
                        containers: [ controllerContainer ],
                        serviceAccountName: name + "-kcc",
                        volumes: [
                            { name: "cloud-config", configMap: { name: name + "-kcc", optional: false}},
                            { name: "kubeconfig", secret: { secretName: name + "-kubeconfig", optional: false}}
                        ]
                    }
                }
            } 
        }

        try {
            let data = await lastValueFrom(this.k8sService.createServiceAccount(serviceAccount));
            data = await lastValueFrom(this.k8sApisService.createRoleBinding(roleBinding));
            data = await lastValueFrom(this.k8sService.createConfigMap(configMap));
            data = await lastValueFrom(this.k8sApisService.createDeployment(controllerDeployment));
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Create Cluster Autoscaler Controller 
     */
    async loadClusterAutoscaler(namespace: string, name: string): Promise<void> {
        /* Load Custom Labels OPTIONAL */
        let labelsForm = this.getLabels();
        let tmpLabels = {};
        for (let i = 0; i < labelsForm.length; i++) {
            let thisLabel = {
                [labelsForm[i].labelKey.toString()] : labelsForm[i].labelValue
            };
            Object.assign(tmpLabels, thisLabel);
        }

        /* Load labels */
        let thisLabel = { [this.myConstants.KubevirtManagerCluster]: name };
        Object.assign(tmpLabels, thisLabel);
        let kubevirtManagerLabel = { [this.myConstants.KubevirtManagerManaged]: "true" };
        Object.assign(tmpLabels, kubevirtManagerLabel);
        Object.assign(tmpLabels, { [this.myConstants.KubernetesClusterName]: name });
        Object.assign(tmpLabels, { [this.myConstants.KubernetesCapkTemplateKind]: "extra-resource" });

        /* Service Account */
        let serviceAccount: ServiceAccount = {
            apiVersion: "v1",
            kind: "ServiceAccount",
            metadata: {
                name: name + "-cas",
                namespace: namespace,
                labels: tmpLabels
            }
        };

        /* ClusterRole Binding */
        let clusterRoleBindingMgmt: ClusterRoleBinding = {
            apiVersion: "rbac.authorization.k8s.io/v1",
            kind: "ClusterRoleBinding",
            metadata: {
                name: namespace + "-" + name + "-cas-management",
                labels: tmpLabels
            },
            roleRef: {
                apiGroup: "rbac.authorization.k8s.io",
                kind: "ClusterRole",
                name: "kubevirt-manager-cas-management"
            },
            subjects: [{
                kind: "ServiceAccount",
                name: name + "-cas",
                namespace: namespace
            }]
        }

        /* ClusterRole Binding */
        let clusterRoleBindingWkld: ClusterRoleBinding = {
            apiVersion: "rbac.authorization.k8s.io/v1",
            kind: "ClusterRoleBinding",
            metadata: {
                name: namespace + "-" + name + "-cas-workload",
                labels: tmpLabels
            },
            roleRef: {
                apiGroup: "rbac.authorization.k8s.io",
                kind: "ClusterRole",
                name: "kubevirt-manager-cas-workload"
            },
            subjects: [{
                kind: "ServiceAccount",
                name: name + "-cas",
                namespace: namespace
            }]
        }

        /* Controller */
        let controllerLabels = tmpLabels;
        Object.assign(controllerLabels, { 'app': name + "cas" });

        /* Container spec */
        let autoscalerContainer = {
            name: "cluster-autoscaler",
            image: "registry.k8s.io/autoscaling/cluster-autoscaler:v1.30.0",
            args: [
                "--v=3",
                "--alsologtostderr",
                "--cloud-provider=clusterapi",
                "--kubeconfig=/mnt/kubeconfig/value",
                "--clusterapi-cloud-config-authoritative",
                "--node-group-auto-discovery=clusterapi:clusterName=" + name,
                "--scan-interval=30s",
                "--scale-down-enabled=true",
                "--scale-down-utilization-threshold=0.5",
                "--scale-down-non-empty-candidates-count=30",
                "--scale-down-delay-after-add=10m",
                "--scale-down-delay-after-delete=30s",
                "--skip-nodes-with-system-pods=false"
            ],
            command: ["/cluster-autoscaler"],
            imagePullPolicy: "Always",
            volumeMounts: [
                {
                    mountPath: "/mnt/kubeconfig",
                    name: "kubeconfig",
                    readOnly: true
                }
            ]
        }

        /* Deployment spec */
        let autoscalerDeployment: Deployment = {
            apiVersion: "apps/v1",
            kind: "Deployment",
            metadata: {
                name: name + "-cas",
                namespace: namespace,
                labels: controllerLabels
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: controllerLabels
                },
                template: {
                    metadata: {
                        labels: controllerLabels
                    },
                    spec: {
                        containers: [ autoscalerContainer ],
                        serviceAccountName: name + "-cas",
                        volumes: [
                            { name: "kubeconfig", secret: { secretName: name + "-kubeconfig", optional: false}}
                        ]
                    }
                }
            } 
        }


        try {
            let data = await lastValueFrom(this.k8sService.createServiceAccount(serviceAccount));
            data = await lastValueFrom(this.k8sApisService.createClusterRoleBinding(clusterRoleBindingMgmt));
            data = await lastValueFrom(this.k8sApisService.createClusterRoleBinding(clusterRoleBindingWkld));
            data = await lastValueFrom(this.k8sApisService.createDeployment(autoscalerDeployment));
        } catch (e: any) {
            console.log(e);
        }        
    }

    /*
     * Retrieve Image Url
     */
    getImageUrl(version: string, osdist: string, osversion: string): string {
        let myUrl = "";
        for(let i = 0; i < this.clusterImageList.versions.length; i++) {
            if(this.clusterImageList.versions[i].id == version) {
                for(let j = 0; j < this.clusterImageList.versions[i].flavors.length; j++) {
                    if(this.clusterImageList.versions[i].flavors[j].id == osdist) {
                        for(let k = 0; k < this.clusterImageList.versions[i].flavors[j].versions.length; k++) {
                            if(this.clusterImageList.versions[i].flavors[j].versions[k].id == osversion) {
                                myUrl = this.clusterImageList.versions[i].flavors[j].versions[k].image;
                            }
                        }
                    }
                }
            }
        }
        return myUrl.toString();
    }

    /*
     * Retrieve CNI Url
     */
    getCNIUrl(cni: string, version: string): string {
        let myUrl = "";
        for(let i = 0; i < this.cniList.cnis.length; i++) {
            if(this.cniList.cnis[i].id == cni) {
                for(let j = 0; j < this.cniList.cnis[i].versions.length; j++) {
                    if(this.cniList.cnis[i].versions[j].id == version) {
                        myUrl = this.cniList.cnis[i].versions[j].filename;
                    }
                }
            }
        }
        return myUrl.toString();
    }

    /*
     * Generate Base 64 from URL Content
     */
    async generateBase64(Url: string): Promise<string> {
        let myBase64 = "";
        let myData = await lastValueFrom(this.kubevirtMgrCapk.loadFile(Url));
        myBase64 = Buffer.from(myData).toString('base64');
        return myBase64;
    }

    /*
     * Generate CNI Base64 with CIDR
     */
    async generateCNIBase64(Url: string, cidr: string, port: string): Promise<string> {
        let myBase64 = "";
        let cniData = await lastValueFrom(this.kubevirtMgrCapk.loadFile(Url));
        let myData = cniData.toString().replace("KUBEVIRTMGR_POD_CIDR", cidr);
        myData = myData.replace("KUBEVIRTMGR_VXLAN_PORT", port);
        myBase64 = Buffer.from(myData).toString('base64');
        return myBase64;
    }

    /*
     * Generate VXLAN tunnel port
     */
    generateVXLANPort(): Number {
        // Random number between 6700-6800
        return Math.floor(Math.random() * (6800 - 6700 + 1) + 6700)
    }

    /*
     * Check Cluster Exists
     */
    checkClusterExists(clusterName: string, clusterNamespace:string): boolean {
        for (let i = 0; i < this.clusterList.length; i++) {
            if(this.clusterList[i].name == clusterName && this.clusterList[i].namespace == clusterNamespace) {
                return true;
            }
        }
        return false;
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
     * UPDATE New Cluster DNS according to cluster name
     */
    updateClusterDNS(newname: string): void {
        let suffix = ".cluster.local";
        let clusterDNSField = document.getElementById("newcluster-dns");
        if(clusterDNSField != null) {
            clusterDNSField.setAttribute("value", newname + suffix);
        }
    }

    /*
     * UPDATE New Cluster DNS according to cluster name
     */
    updateClusterDNSCustom(newname: string): void {
        let suffix = ".cluster.local";
        let clusterDNSField = document.getElementById("newclustercustom-dns");
        if(clusterDNSField != null) {
            clusterDNSField.setAttribute("value", newname + suffix);
        }
    }

    /*
     * UPDATE New Cluster DNS according to cluster name
     */
    onChangeCNI(cni: string): void {
        let clusterCNIVersionField = document.getElementById("newcluster-cniversion");
        let clusterCNIVersionValues = "";
        if(cni == "manual") {
            if(clusterCNIVersionField != null) {
                clusterCNIVersionField.setAttribute("disabled", "disabled");
                clusterCNIVersionField.innerHTML = clusterCNIVersionValues;
            }
        } else {
            for(let i = 0; i < this.cniList.cnis.length; i++) {
                if(this.cniList.cnis[i].id == cni) {
                    for(let j = 0; j < this.cniList.cnis[i].versions.length; j++) {
                        clusterCNIVersionValues += "<option value=" +  this.cniList.cnis[i].versions[j].id +">" + this.cniList.cnis[i].versions[j].name + "</option>\n";
                    }
                }
            }
            if(clusterCNIVersionField != null) {
                clusterCNIVersionField.removeAttribute("disabled");
                clusterCNIVersionField.innerHTML = clusterCNIVersionValues;
            }
        }
    }

    /*
     * UPDATE: Fill Distro Options for Control Plane and Node Pool and Enable CNI Field
     */
    onChangeKubernetesVersion(version: string): void {
        let clusterCNIField = document.getElementById("newcluster-cni");
        let controlPlaneOSField = document.getElementById("newcluster-controlplane-osdist");
        let nodePoolOSField = document.getElementById("newcluster-nodepool-osdist");
        let operatingSystems = "";
        if(version == "none") {
            if(clusterCNIField != null) {
                clusterCNIField.setAttribute("disabled","disabled");
            }
            if(controlPlaneOSField != null && nodePoolOSField != null) {
                controlPlaneOSField.innerHTML = operatingSystems;
                nodePoolOSField.innerHTML = operatingSystems;
            }
        } else {
            operatingSystems = "<option value=none></option>";
            for(let i = 0; i < this.clusterImageList.versions.length; i++) {
                if(this.clusterImageList.versions[i].id == version) {
                    for(let j = 0; j < this.clusterImageList.versions[i].flavors.length; j++) {
                        operatingSystems += "<option value=" +  this.clusterImageList.versions[i].flavors[j].id +">" + this.clusterImageList.versions[i].flavors[j].name + "</option>\n";
                    }
                }
            }
            if(controlPlaneOSField != null && nodePoolOSField != null) {
                controlPlaneOSField.innerHTML = operatingSystems;
                nodePoolOSField.innerHTML = operatingSystems;
            }
            if(clusterCNIField != null) {
                clusterCNIField.removeAttribute("disabled");
            }
        }
    }

    /*
     * UPDATE: Enable / Disable Autoscaling Fields
     */
    onChangeClusterAutoscaler(option: string): void {
        let autoscalerMin = document.getElementById("newcluster-nodepool-minreplicas");
        let autoscalerMax = document.getElementById("newcluster-nodepool-maxreplicas");
        if(option == "false") {
            if(autoscalerMin != null) {
                autoscalerMin.setAttribute("disabled","disabled");
            }
            if(autoscalerMax != null) {
                autoscalerMax.setAttribute("disabled","disabled");
            }
        } else {
            if(autoscalerMax != null) {
                autoscalerMax.removeAttribute("disabled");
            }
            if(autoscalerMin != null) {
                autoscalerMin.removeAttribute("disabled");
            }
        }
    }

    /*
     * UPDATE: Fill Distro Versions fro Control Plane
     */
    onChangeControlPlaneOS(version: string, os: string): void {
        let controlPlaneOSVersionField = document.getElementById("newcluster-controlplane-osversion");
        let operatingSystemVersions = "";
        if(os == "none") {
            if(controlPlaneOSVersionField != null) {
                controlPlaneOSVersionField.innerHTML = operatingSystemVersions;
            }
        } else {
            for(let i = 0; i < this.clusterImageList.versions.length; i++) {
                if(this.clusterImageList.versions[i].id == version) {
                    for(let j = 0; j < this.clusterImageList.versions[i].flavors.length; j++) {
                        if(this.clusterImageList.versions[i].flavors[j].id == os) {
                            for(let k = 0; k < this.clusterImageList.versions[i].flavors[j].versions.length; k++) {
                                operatingSystemVersions += "<option value=" +  this.clusterImageList.versions[i].flavors[j].versions[k].id +">" + this.clusterImageList.versions[i].flavors[j].versions[k].printablename + "</option>\n";
                            }
                        }
                    }
                }
            }
            if(controlPlaneOSVersionField != null) {
                controlPlaneOSVersionField.innerHTML = operatingSystemVersions;
            }
        }
    }

    /*
     * UPDATE: Fill Distro Versions fro Node Pool
     */
    onChangeNodePoolOS(version: string, os: string): void {
        let nodePoolOSVersionField = document.getElementById("newcluster-nodepool-osversion");
        let operatingSystemVersions = "";
        if(os == "none") {
            if(nodePoolOSVersionField != null) {
                nodePoolOSVersionField.innerHTML = operatingSystemVersions;
            }
        } else {
            for(let i = 0; i < this.clusterImageList.versions.length; i++) {
                if(this.clusterImageList.versions[i].id == version) {
                    for(let j = 0; j < this.clusterImageList.versions[i].flavors.length; j++) {
                        if(this.clusterImageList.versions[i].flavors[j].id == os) {
                            for(let k = 0; k < this.clusterImageList.versions[i].flavors[j].versions.length; k++) {
                                operatingSystemVersions += "<option value=" +  this.clusterImageList.versions[i].flavors[j].versions[k].id +">" + this.clusterImageList.versions[i].flavors[j].versions[k].printablename + "</option>\n";
                            }
                        }
                    }
                }
            }
            if(nodePoolOSVersionField != null) {
                nodePoolOSVersionField.innerHTML = operatingSystemVersions;
            }
        }
    }

    /*
     * Control Plane Type
     */
    async onChangeControlPlaneType(vmType: string) {
        let modalDiv = document.getElementById("controlplane-custom-cpu-memory");
        if(vmType.toLowerCase() == "custom") {
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
     * Custom Cluster: Control Plane Type
     */
    async onChangeCustomControlPlaneType(vmType: string) {
        let modalDiv = document.getElementById("newclustercustom-controlplane-custom-cpu-memory");
        if(vmType.toLowerCase() == "custom") {
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
     * Node Pool Type
     */
    async onChangeNodePoolType(vmType: string) {
        let modalDiv = document.getElementById("nodepool-custom-cpu-memory");
        if(vmType.toLowerCase() == "custom") {
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
     * Custom Cluster: Node Pool Type
     */
    async onChangeCustomNodePoolType(vmType: string) {
        let modalDiv = document.getElementById("newclustercustom-nodepool-custom-cpu-memory");
        if(vmType.toLowerCase() == "custom") {
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
     * Control Plane: Firmware
     */
    async onChangeStdControlPlaneFirmware(firmware: string) {
        let secureBootValueField = document.getElementById("newcluster-controlplane-secureboot");
        if(firmware == "uefi") {
            if (secureBootValueField != null) {
                secureBootValueField.removeAttribute("disabled");
            }
        } else if (firmware == "bios") {
            if (secureBootValueField != null) {
                secureBootValueField.setAttribute("disabled", "disabled");
            }
        }
    }

    /*
     * Node Pool: Firmware
     */
    async onChangeStdNodePoolFirmware(firmware: string) {
        let secureBootValueField = document.getElementById("newcluster-nodepool-secureboot");
        if(firmware == "uefi") {
            if (secureBootValueField != null) {
                secureBootValueField.removeAttribute("disabled");
            }
        } else if (firmware == "bios") {
            if (secureBootValueField != null) {
                secureBootValueField.setAttribute("disabled", "disabled");
            }
        }
    }

    /*
     * Control Plane: Firmware
     */
    async onChangeCustomControlPlaneFirmware(firmware: string) {
        let secureBootValueField = document.getElementById("newclustercustom-controlplane-secureboot");
        if(firmware == "uefi") {
            if (secureBootValueField != null) {
                secureBootValueField.removeAttribute("disabled");
            }
        } else if (firmware == "bios") {
            if (secureBootValueField != null) {
                secureBootValueField.setAttribute("disabled", "disabled");
            }
        }
    }

    /*
     * Node Pool: Firmware
     */
    async onChangeCustomNodePoolFirmware(firmware: string) {
        let secureBootValueField = document.getElementById("newclustercustom-nodepool-secureboot");
        if(firmware == "uefi") {
            if (secureBootValueField != null) {
                secureBootValueField.removeAttribute("disabled");
            }
        } else if (firmware == "bios") {
            if (secureBootValueField != null) {
                secureBootValueField.setAttribute("disabled", "disabled");
            }
        }
    }

    /*
     * Load CRDs
     */
    async loadCrds(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sApisService.getCrds());
            this.crdList = data.items;
        } catch (e: any) {
            this.crdList = [];
        }
    }

    /*
     * Check CDI Support
     */
    async checkCDI(): Promise<void> {
        for (let i = 0; i < this.crdList.length; i++) {
            if(this.crdList[i].metadata["name"] == this.myConstants.ContainerizedDataImporter) {
                this.cdiCheck = true;
            }
        }
    }

    /*
     * full reload
     */
    fullReload(): void {
        this.router.navigateByUrl('/refresh',{skipLocationChange:true}).then(()=>{
            this.router.navigate([`/kcluster`]);
        })
    }

}
