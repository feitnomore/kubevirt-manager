import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { KubeVirtVM } from 'src/app/models/kube-virt-vm.model';
import { KubeVirtVMI } from 'src/app/models/kube-virt-vmi.model';
import { KubeVirtVMPool } from 'src/app/models/kube-virt-vmpool.model';
import { LivenessProbe } from 'src/app/models/liveness-probe.model';
import { ReadinessProbe } from 'src/app/models/readiness-probe.model';
import { K8sApisService } from 'src/app/services/k8s-apis.service';
import { KubeVirtService } from 'src/app/services/kube-virt.service';
import { Probe } from 'src/app/interfaces/probe';
import { VMNewtork } from 'src/app/models/vmnewtork.model';
import { KubeVirtClusterInstanceType } from 'src/app/models/kube-virt-clusterinstancetype';
import { Constants } from 'src/app/classes/constants';
import { Toasts } from 'src/app/classes/toasts';

@Component({
  selector: 'app-vmpooldetails',
  templateUrl: './vmpooldetails.component.html',
  styleUrls: ['./vmpooldetails.component.css']
})
export class VmpooldetailsComponent implements OnInit {

    pageName: string = "VM Pool Details";

    myConstants!: Constants;
    myToasts!: Toasts;
    poolName: string = "";
    poolNamespace: string = "";
    poolNetwork = {
        name: "",
        type: "",
        network: ""
    };

    activePool: KubeVirtVMPool = new KubeVirtVMPool;
    vmList: KubeVirtVM[] = [];
    vmiList: KubeVirtVMI[] = [];
    clusterInstanceTypeList: KubeVirtClusterInstanceType[] = [];
    customTemplate: boolean = false;
    thisLivenessType: string = "";
    thisReadinessType: string = "";

    /* Liveness form */
    selectedLivenessType: any;
    inputLivenessPath: any;
    inputLivenessPort: any;
    inputLivenessDelay: any;
    inputLivenessInterval: any;
    inputLivenessTimeout: any;
    inputLivenessFailure: any;
    inputLivenessSuccess: any;

    /* Readiness form */
    selectedReadinessType: any;
    inputReadinessPath: any;
    inputReadinessPort: any;
    inputReadinessDelay: any;
    inputReadinessInterval: any;
    inputReadinessTimeout: any;
    inputReadinessFailure: any;
    inputReadinessSuccess: any;

    /* All Disks */
    diskList: {
                "name": string;
                "namespace": string;
                "type": string;
                "backend": string;
                "dataVolumeName": string;
                "dataVolumeNamespace": string;
                "dataVolumeSource": string;
                "dataVolumeSourceValue": string;
                "accessMode": string;
                "cacheMode": string;
                "capacity":  string;
                "storageClass": string;
        
            }[] = [];

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private k8sApisService: K8sApisService,
        private kubeVirtService: KubeVirtService
    ) { }

    async ngOnInit(): Promise<void> {
        this.poolName = this.route.snapshot.params['name'];
        this.poolNamespace = this.route.snapshot.params['namespace'];
        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren(this.pageName);
        }
        this.myConstants = new Constants();
        this.myToasts = new Toasts();
        await this.getClusterInstanceTypes();
        await this.getVMIs();
        await this.loadPool();
    }

    /*
     * Load VM Pool
     */
    async loadPool(): Promise<void> {
        const data = await lastValueFrom(this.kubeVirtService.getVMPool(this.poolNamespace, this.poolName));

        this.activePool = new KubeVirtVMPool();
        this.activePool.name = data.metadata["name"];
        this.activePool.namespace = data.metadata["namespace"];
        if(data.metadata.labels != null) {
            this.activePool.labels = data.metadata.labels;
        }
        this.activePool.creationTimestamp = new Date(data.metadata["creationTimestamp"]);
        this.activePool.replicas = data.spec["replicas"];
        
        try {
            this.activePool.runStrategy = data.spec.virtualMachineTemplate.spec["runStrategy"];
        } catch (e: any) {
            this.activePool.runStrategy = "";
            console.log("Error loading Pool runStrategy");
        }

        /* Getting VM Type */
        try {
            this.activePool.instType = data.spec.virtualMachineTemplate.spec.instancetype.name;
            this.customTemplate = false;
        } catch(e: any) {
            this.activePool.instType = "custom";
            this.customTemplate = true;
            console.log(e);
        }

        /* Getting Ready Replicas */
        if(data.status["readyReplicas"] != null) {
            try {
                this.activePool.readyReplicas = Number(data.status["readyReplicas"]);
                this.activePool.running = true;
            } catch (e: any) {
                this.activePool.running = false;
                this.activePool.readyReplicas = 0;
                console.log(e);
            }
        } else {
            this.activePool.running = false;
        }

        /* Liveness Probe */
        if(data.spec.virtualMachineTemplate.spec.template.spec["livenessProbe"] != null) {
            let thisLivenessProbe = new LivenessProbe;
            thisLivenessProbe.failureThreshold = data.spec.virtualMachineTemplate.spec.template.spec.livenessProbe["failureThreshold"];
            thisLivenessProbe.initDelaySeconds = data.spec.virtualMachineTemplate.spec.template.spec.livenessProbe["initialDelaySeconds"];
            thisLivenessProbe.periodSeconds = data.spec.virtualMachineTemplate.spec.template.spec.livenessProbe["periodSeconds"];
            thisLivenessProbe.successThreshold = data.spec.virtualMachineTemplate.spec.template.spec.livenessProbe["successThreshold"];
            thisLivenessProbe.timeoutSeconds = data.spec.virtualMachineTemplate.spec.template.spec.livenessProbe["timeoutSeconds"];
            this.inputLivenessFailure = thisLivenessProbe.failureThreshold;
            this.inputLivenessDelay = thisLivenessProbe.initDelaySeconds;
            this.inputLivenessInterval = thisLivenessProbe.periodSeconds;
            this.inputLivenessSuccess = thisLivenessProbe.successThreshold;
            this.inputLivenessTimeout = thisLivenessProbe.timeoutSeconds;
            if(data.spec.virtualMachineTemplate.spec.template.spec.livenessProbe["httpGet"] != null ) {
                this.thisLivenessType = "http";
                this.selectedLivenessType = "http";
                thisLivenessProbe.httpGet.path = data.spec.virtualMachineTemplate.spec.template.spec.livenessProbe.httpGet["path"];
                thisLivenessProbe.httpGet.port = data.spec.virtualMachineTemplate.spec.template.spec.livenessProbe.httpGet["port"];
                this.inputLivenessPath = thisLivenessProbe.httpGet.path;
                this.inputLivenessPort = thisLivenessProbe.httpGet.port;
            } else {
                this.thisLivenessType = "tcp";
                this.selectedLivenessType = "tcp";
                thisLivenessProbe.tcpSocket.port = data.spec.virtualMachineTemplate.spec.template.spec.livenessProbe.tcpSocket["port"];
                this.inputLivenessPort = thisLivenessProbe.tcpSocket.port;
            }
            this.activePool.livenessProbe = thisLivenessProbe;
            this.activePool.hasLiveness = true;
        }

        /* Readiness Probe */
        if(data.spec.virtualMachineTemplate.spec.template.spec["readinessProbe"] != null) {
            let thisReadinessProbe = new ReadinessProbe;
            thisReadinessProbe.failureThreshold = data.spec.virtualMachineTemplate.spec.template.spec.readinessProbe["failureThreshold"];
            thisReadinessProbe.initDelaySeconds = data.spec.virtualMachineTemplate.spec.template.spec.readinessProbe["initialDelaySeconds"];
            thisReadinessProbe.periodSeconds = data.spec.virtualMachineTemplate.spec.template.spec.readinessProbe["periodSeconds"];
            thisReadinessProbe.successThreshold = data.spec.virtualMachineTemplate.spec.template.spec.readinessProbe["successThreshold"];
            thisReadinessProbe.timeoutSeconds = data.spec.virtualMachineTemplate.spec.template.spec.readinessProbe["timeoutSeconds"];
            this.inputReadinessFailure = thisReadinessProbe.failureThreshold;
            this.inputReadinessDelay = thisReadinessProbe.initDelaySeconds;
            this.inputReadinessInterval = thisReadinessProbe.periodSeconds;
            this.inputReadinessSuccess = thisReadinessProbe.successThreshold;
            this.inputReadinessTimeout = thisReadinessProbe.timeoutSeconds;
            if(data.spec.virtualMachineTemplate.spec.template.spec.readinessProbe["httpGet"] != null ) {
                this.thisReadinessType = "http";
                this.selectedReadinessType = "http";
                thisReadinessProbe.httpGet.path = data.spec.virtualMachineTemplate.spec.template.spec.readinessProbe.httpGet["path"];
                thisReadinessProbe.httpGet.port = data.spec.virtualMachineTemplate.spec.template.spec.readinessProbe.httpGet["port"];
                this.inputReadinessPath = thisReadinessProbe.httpGet.path;
                this.inputReadinessPort = thisReadinessProbe.httpGet.port;
            } else {
                this.thisReadinessType = "tcp";
                this.selectedReadinessType = "tcp";
                thisReadinessProbe.tcpSocket.port = data.spec.virtualMachineTemplate.spec.template.spec.readinessProbe.tcpSocket["port"];
                this.inputReadinessPort = thisReadinessProbe.tcpSocket.port;
            }
            this.activePool.readinessProbe = thisReadinessProbe;
            this.activePool.hasReadiness = true;
        }

        if(this.activePool.instType == "custom") {
            /* Custom VM has cpu / mem parameters */
            this.activePool.cores = data.spec.virtualMachineTemplate.spec.template.spec.domain.cpu["cores"];
            this.activePool.sockets = data.spec.virtualMachineTemplate.spec.template.spec.domain.cpu["sockets"];
            this.activePool.threads = data.spec.virtualMachineTemplate.spec.template.spec.domain.cpu["threads"];
            this.activePool.memory = data.spec.virtualMachineTemplate.spec.template.spec.domain.resources.requests["memory"];
        } else {
            /* load vCPU / Mem from type */
            for(let j = 0; j < this.clusterInstanceTypeList.length; j++) {
                if(this.clusterInstanceTypeList[j].name == this.activePool.instType) {
                    this.activePool.cores = this.clusterInstanceTypeList[j].cores;
                    this.activePool.memory = this.clusterInstanceTypeList[j].memory;
                    this.activePool.sockets = this.clusterInstanceTypeList[j].sockets;
                    this.activePool.threads = this.clusterInstanceTypeList[j].threads;
                }
            }
        }
        try {
            this.activePool.priorityClass = data.spec.virtualMachineTemplate.spec.template.spec.priorityClassName;
        } catch (e: any) {
            this.activePool.priorityClass = "";
            console.log(e);
        }

        try {
            if(data.spec.virtualMachineTemplate.spec.template.spec.domain.firmware.bootloader.bios != null) {
                this.activePool.firmware = "bios";
            }
        } catch (e: any) {
            this.activePool.firmware = "";
        }

        try {
            if(data.spec.virtualMachineTemplate.spec.template.spec.domain.firmware.bootloader.efi != null) {
                this.activePool.firmware = "efi";
            }
        } catch (e: any) {
            this.activePool.firmware = "";
        }

        if(this.activePool.firmware == "efi") {
            try {
                if(data.spec.virtualMachineTemplate.spec.template.spec.domain.firmware.bootloader.efi.secureBoot == true) {
                    this.activePool.secureBoot = true;
                } else {
                    this.activePool.secureBoot = false;
                }
            } catch(e: any) {
                this.activePool.secureBoot = false;
            }
        }

        /* Loading Network Info */
        await this.loadNetInfo(data.spec.virtualMachineTemplate.spec.template.spec.domain.devices.interfaces, data.spec.virtualMachineTemplate.spec.template.spec.networks);

        /* Load Disks */
        this.loadDiskInfo(data.spec.virtualMachineTemplate);

        await this.getPoolVM(this.activePool.namespace, this.activePool.name);
        this.activePool.vmlist = this.vmList;
        this.activePool = this.activePool;
    }

    /*
     * Load Network Information
     */
    async loadNetInfo(interfaces: any, networks: any): Promise<void> {

        if(interfaces != null && networks != null) {
            for(let i = 0; i < interfaces.length; i++) {
                let netInfo = new VMNewtork;
                netInfo.id = i;
                netInfo.name = interfaces[i].name;
                netInfo.hotplug = false;
                try {
                    netInfo.network = networks[i].multus.networkName;
                } catch (e: any) {
                    netInfo.network = "podNetwork";
                }

                try {
                    if(interfaces[i].masquerade != null) {
                        netInfo.type = "masquerade";
                    } else {
                        netInfo.type = "bridge";
                    }
                } catch (e: any) {
                    netInfo.type = "bridge";
                }

                try {
                    if(interfaces[i].model != null) {
                        netInfo.driver = interfaces[i].model;
                    } else {
                        netInfo.driver = "virtio";
                    }
                } catch (e: any) {
                    netInfo.driver = "N/A";
                }
                this.activePool.networkList.push(netInfo);
            }
        }
    }

    /*
     * Load VM List
     */
    async getPoolVM(namespace: string, poolName: string): Promise<void> {
        this.vmList = [];
        let currentVm = new KubeVirtVM;
        const data = await lastValueFrom(this.kubeVirtService.getPooledVM(namespace, poolName));
        let vms = data.items;
        for (let i = 0; i < vms.length; i++) {
            currentVm = new KubeVirtVM();
            currentVm.name = vms[i].metadata["name"];
            currentVm.namespace = vms[i].metadata["namespace"];
            if(vms[i].metadata["labels"] != null) {
                currentVm.labels = Object.entries(vms[i].metadata.labels);
            }
            currentVm.creationTimestamp = new Date(vms[i].metadata["creationTimestamp"]);
            currentVm.running = vms[i].spec["running"];
            currentVm.status = vms[i].status["printableStatus"].toLowerCase();
            if (currentVm.status.toLowerCase() == "running") {
                currentVm.running = true;
            }
            if (vms[i].spec.template.spec.nodeSelector !== undefined && vms[i].spec.template.spec.nodeSelector[this.myConstants.KubernetesHostname] !== undefined && vms[i].spec.template.spec.nodeSelector[this.myConstants.KubernetesHostname] != "") { 
                currentVm.nodeSel = vms[i].spec.template.spec.nodeSelector[this.myConstants.KubernetesHostname];
            } else {
                currentVm.nodeSel = "auto-select";
            }

            /* Getting VM Type */
            try {
                currentVm.instType = vms[i].spec.instancetype.name;
            } catch(e: any) {
                currentVm.instType = "custom";
                console.log(e);
            }

            if(currentVm.instType == "custom") {
                /* Custom VM has cpu / mem parameters */
                currentVm.cores = vms[i].spec.template.spec.domain.cpu["cores"];
                currentVm.sockets = vms[i].spec.template.spec.domain.cpu["sockets"];
                currentVm.threads = vms[i].spec.template.spec.domain.cpu["threads"];
                currentVm.memory = vms[i].spec.template.spec.domain.resources.requests["memory"];
            } else {
                /* load vCPU / Mem from type */
                for(let j = 0; j < this.clusterInstanceTypeList.length; j++) {
                    if(this.clusterInstanceTypeList[j].name == currentVm.instType) {
                        currentVm.cores = this.clusterInstanceTypeList[j].cores;
                        currentVm.memory = this.clusterInstanceTypeList[j].memory;
                        currentVm.sockets = this.clusterInstanceTypeList[j].sockets;
                        currentVm.threads = this.clusterInstanceTypeList[j].threads;
                    }
                }
            }

            if(vms[i].status["ready"] != null) {
                currentVm.ready = vms[i].status["ready"];
            }

            if(currentVm.running && currentVm.status && vms[i].status["printableStatus"].toLowerCase() == "running") {
                for(let k = 0; k < this.vmiList.length; k++) {
                    if(this.vmiList[k].namespace == currentVm.namespace && this.vmiList[k].name == currentVm.name) {
                        currentVm.vmi = this.vmiList[k];
                        currentVm.nodeSel = currentVm.vmi.nodeName;
                    }
                }
            }
            this.vmList.push(currentVm);
        }
    }

    /*
     * Load VMIs
     */
    async getVMIs(): Promise<void> {
        let currentVmi = new KubeVirtVMI;
        try {
            const datavmi = await lastValueFrom(this.kubeVirtService.getPooledVMI(this.poolNamespace, this.poolName));
            let vmis = datavmi.items;
            for (let i = 0; i < vmis.length; i++) {
                currentVmi = new KubeVirtVMI();
                currentVmi.name = vmis[i].metadata["name"];
                currentVmi.namespace = vmis[i].metadata["namespace"];

                /* Only works with guest-agent installed if not on podNetwork */
                try {
                    /* In case of dual NIC, test which one is providing IP */
                    if(vmis[i].status.interfaces[0]["ipAddress"] != null) {                        
                        currentVmi.ifAddr = vmis[i].status.interfaces[0]["ipAddress"];
                        currentVmi.ifName = vmis[i].status.interfaces[0]["name"];
                    } else {
                        currentVmi.ifAddr = vmis[i].status.interfaces[1]["ipAddress"];
                        currentVmi.ifName = vmis[i].status.interfaces[1]["name"];
                    }
                } catch(e: any) {
                    currentVmi.ifAddr = "";
                    currentVmi.ifName = "";
                }

                currentVmi.nodeName = vmis[i].status["nodeName"];
                this.vmiList.push(currentVmi)
            }
        } catch (e: any) {
            console.log("ERROR Retrieving VMI list");
        }
    }

    /*
     * Load Instance Types
     */
    async getClusterInstanceTypes(): Promise<void> {
        let currentClusterInstanceType = new KubeVirtClusterInstanceType;
        try {
            const datacit = await lastValueFrom(this.kubeVirtService.getClusterInstanceTypes());
            let cits = datacit.items;
            for (let i = 0; i < cits.length; i++) {
                currentClusterInstanceType = new KubeVirtClusterInstanceType();
                try {
                    currentClusterInstanceType.name = cits[i].metadata.name;
                    currentClusterInstanceType.cores = cits[i].spec.cpu["guest"];
                    currentClusterInstanceType.memory = cits[i].spec.memory["guest"];
                    currentClusterInstanceType.sockets = 1;
                    currentClusterInstanceType.threads = 1;
                } catch (e: any) {
                    currentClusterInstanceType.sockets = 0;
                    currentClusterInstanceType.threads = 0;
                    currentClusterInstanceType.cores = 0;
                    currentClusterInstanceType.memory = "";
                }
                this.clusterInstanceTypeList.push(currentClusterInstanceType);
            }
        } catch (e: any) {
            console.log("ERROR Retrieving ClusterInstanceType list");
        }
    }

    /*
     * Load Disk Info
     */
    loadDiskInfo(virtualMachineTemplate: any): void {
        let all_disks = virtualMachineTemplate.spec.template.spec.domain.devices.disks;
        let all_volumes = virtualMachineTemplate.spec.template.spec.volumes;
        /* Find Disk */
        for (let i = 0; i < all_disks.length; i++) {
            let thisDiskInfo = {
                "name": "",
                "namespace": "",
                "type": "",
                "backend": "",
                "dataVolumeName": "",
                "dataVolumeNamespace": "",
                "dataVolumeSource": "",
                "dataVolumeSourceValue": "",
                "accessMode": "",
                "cacheMode": "",
                "capacity":  "",
                "storageClass": ""
        
            };
            thisDiskInfo.name = all_disks[i].name;
            thisDiskInfo.cacheMode = all_disks[i].cache;
            let keys = Object.keys(all_disks[i]);
            for (let j = 0; j < keys.length; j++) {
                if(keys[j].toLowerCase() != "name") {
                    thisDiskInfo.type = keys[j];
                }
            }
            /* Find Volume related to the Disk */
            for (let k = 0; k < all_volumes.length; k++) {
                if(all_volumes[k].name == thisDiskInfo.name) {
                    let volume_keys = Object.keys(all_volumes[k]);
                    for(let l = 0; l < volume_keys.length; l++) {
                        if(volume_keys[l].toLowerCase() != "name") {
                            if(volume_keys[l].toLowerCase() == "datavolume") {
                                thisDiskInfo.backend = volume_keys[l];
                                thisDiskInfo.dataVolumeName = all_volumes[k].dataVolume.name;
                            }
                        }
                    }
                }
            }

            /* Fetching Data Volume Template */
            if(thisDiskInfo.backend.toLowerCase() == "datavolume") {
                for(let j = 0; j < virtualMachineTemplate.spec.dataVolumeTemplates.length ; j++) {
                    let this_dv = virtualMachineTemplate.spec.dataVolumeTemplates[j];
                    if (this_dv.metadata.name == thisDiskInfo.dataVolumeName) {
                        thisDiskInfo.namespace = this_dv.metadata.namespace;
                        thisDiskInfo.dataVolumeNamespace = this_dv.metadata.namespace;
                        try {
                            thisDiskInfo.accessMode = this_dv.spec.pvc.accessModes[0];
                            thisDiskInfo.capacity = this_dv.spec.pvc.resources.requests["storage"];
                            thisDiskInfo.storageClass = this_dv.spec.pvc["storageClassName"];
                        } catch (e: any) {
                            thisDiskInfo.accessMode = this_dv.spec.storage.accessModes[0];
                            thisDiskInfo.capacity = this_dv.spec.storage.resources.requests["storage"];
                            thisDiskInfo.storageClass = this_dv.spec.storage["storageClassName"];                            
                        }
                        let this_source_keys = Object.keys(this_dv.spec.source);
                        for(let k = 0; k <  this_source_keys.length; k++) {
                            let this_key = this_source_keys[k];
                            switch (this_key) {
                                case "blank": 
                                    thisDiskInfo.dataVolumeSource = "blank";
                                    thisDiskInfo.dataVolumeSourceValue = "";
                                    break;
                                case "s3":
                                    thisDiskInfo.dataVolumeSource = "s3";
                                    thisDiskInfo.dataVolumeSourceValue = virtualMachineTemplate.spec.dataVolumeTemplates[j].spec.source.s3.url;
                                    break;
                                case "gcs":
                                    thisDiskInfo.dataVolumeSource = "gcs";
                                    thisDiskInfo.dataVolumeSourceValue = virtualMachineTemplate.spec.dataVolumeTemplates[j].spec.source.gcs.url;
                                    break;
                                case "http":
                                    thisDiskInfo.dataVolumeSource = "http";
                                    thisDiskInfo.dataVolumeSourceValue = virtualMachineTemplate.spec.dataVolumeTemplates[j].spec.source.http.url;
                                    break;
                                case "registry":
                                    thisDiskInfo.dataVolumeSource = "registry";
                                    thisDiskInfo.dataVolumeSourceValue = virtualMachineTemplate.spec.dataVolumeTemplates[j].spec.source.registry.url;
                                    break;
                                case "pvc":
                                    thisDiskInfo.dataVolumeSource = "pvc";
                                    thisDiskInfo.dataVolumeSourceValue = virtualMachineTemplate.spec.dataVolumeTemplates[j].spec.source.pvc.namespace + " - " + virtualMachineTemplate.spec.dataVolumeTemplates[j].spec.source.pvc.name;
                                    break;
                            }
                        }
                    }
                }
                this.diskList.push(thisDiskInfo);
            }
        }
    }

    /*
     * Show Delete VM Window
     */
    showDeleteVM(vmName: string, vmNamespace: string): void {
        let modalDiv = document.getElementById("modal-deletevm");
        let modalTitle = document.getElementById("deletevm-title");
        let modalBody = document.getElementById("deletevm-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Delete");
        }
        if(modalBody != null) {
            let vmNameInput = document.getElementById("deletevm-name");
            let vmNamespaceInput = document.getElementById("deletevm-namespace");
            if(vmNameInput != null && vmNamespaceInput != null) {
                vmNameInput.setAttribute("value", vmName);
                vmNamespaceInput.setAttribute("value", vmNamespace);
                modalBody.replaceChildren("Are you sure you want to delete " + vmName + " on namespace: " + vmNamespace + "?");
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
     * Remove VM From Pool
     */
    async removeVmFromPool(vmNamespace: string, vmName: string, vmNode: string) {
        try {
            const data = await lastValueFrom(this.kubeVirtService.removeVmFromPool(vmNamespace, vmName, vmNode));
            this.myToasts.toastSuccess(this.pageName, "", "Removed VM from: " + this.activePool.name);
            this.reloadComponent();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, "", e.message);
            console.log(e);
        }
    }


    /*
     * Delete Virtual Machine
     */
    async applyDeleteVM(): Promise<void> {
        let vmNameInput = document.getElementById("deletevm-name");
        let vmNamespaceInput = document.getElementById("deletevm-namespace");
        if(vmNameInput != null && vmNamespaceInput != null) {
            let vmName = vmNameInput.getAttribute("value");
            let vmNamespace = vmNamespaceInput.getAttribute("value");
            if(vmName != null && vmNamespace != null) {
                try {
                    const data = await lastValueFrom(this.kubeVirtService.deleteVm(vmNamespace, vmName));
                    this.hideComponent("modal-deletevm");
                    this.myToasts.toastSuccess(this.pageName, "", "Deleted VM from: " + this.activePool.name);
                    this.reloadComponent();
                } catch (e) {
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
     * Show Replicas Window
     */
    showReplicas(): void {
        let modalDiv = document.getElementById("modal-replicas");
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Perform Resize of VM Pool
     */
    async applyReplicas(poolNamespace: string, poolName: string, replicasSize: string): Promise<void> {
        if(replicasSize != null && poolName != null && poolNamespace != null) {
            try {
                const data = await lastValueFrom(this.kubeVirtService.scalePoolReplicas(poolNamespace, poolName, replicasSize));
                this.hideComponent("modal-resize");
                this.myToasts.toastSuccess(this.pageName, "", "Edited VM Pool: " + poolName);
                this.reloadComponent();
            } catch (e: any) {
                this.myToasts.toastError(this.pageName, "", e.message);
               console.log(e);
            }
        }
    }

    /*
     * Show Pool Type Window
     */
    async showType(): Promise<void> {
        let modalDiv = document.getElementById("modal-type");
        let selectorTypeFiled = document.getElementById("changepool-type");
        let typeSelectorOptions = "";
        let data = await lastValueFrom(this.kubeVirtService.getClusterInstanceTypes());
        for (let i = 0; i < data.items.length; i++) {
            typeSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
        }
        if (selectorTypeFiled != null) {
            selectorTypeFiled.innerHTML = typeSelectorOptions;
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
     * Change Pool Type
     */
    async applyType(poolNamespace: string, poolName: string, poolType: string): Promise<void> {
        try {
            const data = await lastValueFrom(this.kubeVirtService.changePoolType(poolNamespace, poolName, poolType));
            this.hideComponent("modal-type");
            this.myToasts.toastSuccess(this.pageName, "", "Edited VM Pool: " + poolName);
            this.reloadComponent();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, "", e.message);
            console.log(e);
        }
    }

    /*
     * Show Resize Pool Window
     */
    showResize(poolSockets: number, poolCores: number, poolThreads: number, poolMemory: string): void {
        let modalDiv = document.getElementById("modal-resize");
        let resizeSocketsField = document.getElementById("resize-sockets");
        let resizeCoresField = document.getElementById("resize-cores");
        let resizeThreadsField = document.getElementById("resize-threads");
        let resizeMemoryField = document.getElementById("resize-memory");
        if(resizeSocketsField != null && resizeCoresField != null && resizeThreadsField != null && resizeMemoryField != null) {
            resizeSocketsField.setAttribute("placeholder", poolSockets.toString());
            resizeCoresField.setAttribute("placeholder", poolCores.toString());
            resizeThreadsField.setAttribute("placeholder", poolThreads.toString());
            resizeMemoryField.setAttribute("placeholder", poolMemory.toString());
            resizeSocketsField.setAttribute("value", poolSockets.toString());
            resizeCoresField.setAttribute("value", poolCores.toString());
            resizeThreadsField.setAttribute("value", poolThreads.toString());
            resizeMemoryField.setAttribute("value", poolMemory.replace("Gi", "").toString());
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
     * Resize Virtual Machine Pool
     */
    async applyResize(resizeNamespace: string, resizeName: string, sockets: string, cores: string, threads: string, memory: string): Promise<void> {
        if(sockets != "" && cores != "" && threads != "" && memory != "") {
            try {
                const data = await lastValueFrom(this.kubeVirtService.scalePool(resizeNamespace, resizeName, cores, threads, sockets, memory));
                this.hideComponent("modal-resize");
                this.myToasts.toastSuccess(this.pageName, "", "Edited VM Pool: " + resizeName);
                this.reloadComponent();
            } catch (e: any) {
                this.myToasts.toastError(this.pageName, "", e.message);
                console.log(e);
            }
        }
    }

    /*
     * Show Priority Class Window
     */
    async showPc(): Promise<void> {
        let modalDiv = document.getElementById("modal-pc");
        let selectorPcFiled = document.getElementById("changepool-pc");
        let pcSelectorOptions = "";
        let data = await lastValueFrom(this.k8sApisService.getPriorityClasses());
        for (let i = 0; i < data.items.length; i++) {
            pcSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
        }
        if (selectorPcFiled != null) {
            selectorPcFiled.innerHTML = pcSelectorOptions;
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
     * Change Pool Priority Class
     */
    async applyPc(poolNamespace: string, poolName: string, poolPc: string): Promise<void> {
        try {
            const data = await lastValueFrom(this.kubeVirtService.changePoolPc(poolNamespace, poolName, poolPc));
            this.hideComponent("modal-pc");
            this.myToasts.toastSuccess(this.pageName, "", "Edited VM Pool: " + poolName);
            this.reloadComponent();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, "", e.message);
            console.log(e);
        }
    }

    /*
     * Show Liveness
     */
    async showLiveness(): Promise<void> {
        let modalDiv = document.getElementById("modal-liveness");
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Liveness: Enable/Disable Health Check
     */
    async onChangeLiveness(status: string) {
        let hcType = document.getElementById("pooldetails-liveness-type");
        let hcPort = document.getElementById("pooldetails-liveness-port");
        let hcPath = document.getElementById("pooldetails-liveness-path");
        let hcDelay = document.getElementById("pooldetails-liveness-initialdelay");
        let hcInterval = document.getElementById("pooldetails-liveness-interval");
        let hcTimeout = document.getElementById("pooldetails-liveness-timeout");
        let hcFailure = document.getElementById("pooldetails-liveness-failure");
        let hcSuccess = document.getElementById("pooldetails-liveness-success");
        
        if ( hcType != null && hcPort != null && hcPath != null && hcDelay != null && hcInterval != null && 
             hcTimeout != null && hcFailure != null && hcSuccess != null ) {
            if(status.toLowerCase() == "enabled") {
                hcType.removeAttribute("disabled");
                hcPort.removeAttribute("disabled");
                hcPath.removeAttribute("disabled");
                hcDelay.removeAttribute("disabled");
                hcInterval.removeAttribute("disabled");
                hcTimeout.removeAttribute("disabled");
                hcFailure.removeAttribute("disabled");
                hcSuccess.removeAttribute("disabled");
            } else {
                hcType.setAttribute("disabled", "disabled");
                hcPort.setAttribute("disabled", "disabled");
                hcPath.setAttribute("disabled", "disabled");
                hcDelay.setAttribute("disabled", "disabled");
                hcInterval.setAttribute("disabled", "disabled");
                hcTimeout.setAttribute("disabled", "disabled");
                hcFailure.setAttribute("disabled", "disabled");
                hcSuccess.setAttribute("disabled", "disabled");
            }
        }
    }

    /*
     * Liveness: Change Health Check Type
     */
    async onChangeLivenessType(hcType: string) {
        let modalPath = document.getElementById("pooldetails-liveness-path-panel");
        if (modalPath != null) {
            if (hcType.toLowerCase() == "http") {
                modalPath.setAttribute("class", "modal fade show");
                modalPath.setAttribute("aria-modal", "true");
                modalPath.setAttribute("role", "dialog");
                modalPath.setAttribute("aria-hidden", "false");
                modalPath.setAttribute("style","display: contents;");
            } else {
                modalPath.setAttribute("class", "modal fade");
                modalPath.setAttribute("aria-modal", "false");
                modalPath.setAttribute("role", "");
                modalPath.setAttribute("aria-hidden", "true");
                modalPath.setAttribute("style","display: none;");
            }
        }
    }

    /*
     * Apply Liveness Probe Changes
     */
    async applyLiveness(namespace: string, name: string, enable: string): Promise<void> {

        this.inputLivenessSuccess = Number(1);
        if(enable.toLowerCase() == "disabled") {
            try {
                const data = await lastValueFrom(this.kubeVirtService.removePoolLiveness(namespace, name));
                this.hideComponent("modal-liveness");
                this.myToasts.toastSuccess(this.pageName, "", "Edited VM Pool: " + name);
                this.reloadComponent();
            } catch (e: any) {
                this.myToasts.toastError(this.pageName, "", e.message);
                console.log(e);
            }
        } else {
            let livenessProbe: Probe = {
                initialDelaySeconds: Number(this.inputLivenessDelay),
                periodSeconds: Number(this.inputLivenessInterval),
                timeoutSeconds: Number(this.inputLivenessTimeout),
                failureThreshold: Number(this.inputLivenessFailure),
                successThreshold: Number(this.inputLivenessSuccess)                
            };
            if(this.selectedLivenessType.toLowerCase() == "http") {
                let httpProbe = {
                    path: this.inputLivenessPath,
                    port: Number(this.inputLivenessPort)
                };
                livenessProbe.httpGet = httpProbe;
            } else {
                let tcpProbe = {
                    port: Number(this.inputLivenessPort)
                };
                livenessProbe.tcpSocket = tcpProbe;
            }
            try {
                if(this.activePool.hasLiveness) {
                    const removedata = await lastValueFrom(this.kubeVirtService.removePoolLiveness(namespace, name));
                }
                const data = await lastValueFrom(this.kubeVirtService.updatePoolLiveness(namespace, name, JSON.stringify(livenessProbe)));
                this.hideComponent("modal-liveness");
                this.myToasts.toastSuccess(this.pageName, "", "Edited VM Pool: " + name);
                this.reloadComponent();
            } catch (e: any) {
                this.myToasts.toastError(this.pageName, "", e.message);
                console.log(e);
            }
        }
    }

    /*
     * Show Readiness
     */
    async showReadiness(): Promise<void> {
        let modalDiv = document.getElementById("modal-readiness");
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Readiness: Enable/Disable Health Check
     */
    async onChangeReadiness(status: string) {
        let hcType = document.getElementById("pooldetails-readiness-type");
        let hcPort = document.getElementById("pooldetails-readiness-port");
        let hcPath = document.getElementById("pooldetails-readiness-path");
        let hcDelay = document.getElementById("pooldetails-readiness-initialdelay");
        let hcInterval = document.getElementById("pooldetails-readiness-interval");
        let hcTimeout = document.getElementById("pooldetails-readiness-timeout");
        let hcFailure = document.getElementById("pooldetails-readiness-failure");
        let hcSuccess = document.getElementById("pooldetails-readiness-success");
        
        if ( hcType != null && hcPort != null && hcPath != null && hcDelay != null && hcInterval != null && 
             hcTimeout != null && hcFailure != null && hcSuccess != null ) {
            if(status.toLowerCase() == "enabled") {
                hcType.removeAttribute("disabled");
                hcPort.removeAttribute("disabled");
                hcPath.removeAttribute("disabled");
                hcDelay.removeAttribute("disabled");
                hcInterval.removeAttribute("disabled");
                hcTimeout.removeAttribute("disabled");
                hcFailure.removeAttribute("disabled");
                hcSuccess.removeAttribute("disabled");
            } else {
                hcType.setAttribute("disabled", "disabled");
                hcPort.setAttribute("disabled", "disabled");
                hcPath.setAttribute("disabled", "disabled");
                hcDelay.setAttribute("disabled", "disabled");
                hcInterval.setAttribute("disabled", "disabled");
                hcTimeout.setAttribute("disabled", "disabled");
                hcFailure.setAttribute("disabled", "disabled");
                hcSuccess.setAttribute("disabled", "disabled");
            }
        }
    }

    /*
     * Readiness: Change Health Check Type
     */
    async onChangeReadinessType(hcType: string) {
        let modalPath = document.getElementById("pooldetails-readiness-path-panel");
        if (modalPath != null) {
            if (hcType.toLowerCase() == "http") {
                modalPath.setAttribute("class", "modal fade show");
                modalPath.setAttribute("aria-modal", "true");
                modalPath.setAttribute("role", "dialog");
                modalPath.setAttribute("aria-hidden", "false");
                modalPath.setAttribute("style","display: contents;");
            } else {
                modalPath.setAttribute("class", "modal fade");
                modalPath.setAttribute("aria-modal", "false");
                modalPath.setAttribute("role", "");
                modalPath.setAttribute("aria-hidden", "true");
                modalPath.setAttribute("style","display: none;");
            }
        }
    }

    /*
     * Apply Readiness Probe Changes
     */
    async applyReadiness(namespace: string, name: string, enable: string): Promise<void> {
        this.inputReadinessSuccess = Number(1);
        if(enable.toLowerCase() == "disabled") {
            try {
                const data = await lastValueFrom(this.kubeVirtService.removePoolReadiness(namespace, name));
                this.hideComponent("modal-readiness");
                this.myToasts.toastSuccess("VM Pool Details", "", "Edited VM Pool: " + name);
                this.reloadComponent();
            } catch (e: any) {
                this.myToasts.toastError("VM Pool Details", "", e.message);
                console.log(e);
            }
        } else {
            let readinessProbe: Probe = {
                initialDelaySeconds: Number(this.inputReadinessDelay),
                periodSeconds: Number(this.inputReadinessInterval),
                timeoutSeconds: Number(this.inputReadinessTimeout),
                failureThreshold: Number(this.inputReadinessFailure),
                successThreshold: Number(this.inputReadinessSuccess)                
            };
            if(this.selectedReadinessType.toLowerCase() == "http") {
                let httpProbe = {
                    path: this.inputReadinessPath,
                    port: Number(this.inputReadinessPort)
                };
                readinessProbe.httpGet = httpProbe;
            } else {
                let tcpProbe = {
                    port: this.inputReadinessPort
                };
                readinessProbe.tcpSocket = tcpProbe;
            }
            try {
                if(this.activePool.hasReadiness) {
                    const removedata = await lastValueFrom(this.kubeVirtService.removePoolReadiness(namespace, name));
                }
                const data = await lastValueFrom(this.kubeVirtService.updatePoolReadiness(namespace, name, JSON.stringify(readinessProbe)));
                this.hideComponent("modal-readiness");
                this.myToasts.toastSuccess(this.pageName, "", "Edited VM Pool: " + name);
                this.reloadComponent();
            } catch (e: any) {
                this.myToasts.toastError(this.pageName, "", e.message);
                console.log(e);
            }
        }
    }

    /*
     * VM Basic Operations (start, stop, etc...)
     */
    async vmOperations(vmOperation: string, vmNamespace: string, vmName: string): Promise<void> {
        if(vmOperation == "start"){
            var data = await lastValueFrom(this.kubeVirtService.startVm(vmNamespace, vmName));
            this.myToasts.toastSuccess(this.pageName, "", "Started: " + vmName);
            this.reloadComponent();
        } else if (vmOperation == "stop") {
            var data = await lastValueFrom(this.kubeVirtService.stopVm(vmNamespace, vmName));
            this.myToasts.toastSuccess(this.pageName, "", "Stopped: " + vmName);
            this.reloadComponent();
        } else if (vmOperation == "reboot"){
            var data = await lastValueFrom(this.kubeVirtService.restartVm(vmNamespace, vmName));
            this.myToasts.toastSuccess(this.pageName, "", "Restarted: " + vmName);
            this.reloadComponent();
        } else if (vmOperation == "delete") {
            const data = await lastValueFrom(this.kubeVirtService.deleteVm(vmNamespace, vmName));
            this.myToasts.toastSuccess(this.pageName, "", "Deleted: " + vmName);
            this.reloadComponent();
        }
    }

    /*
     * Open NoVNC
     */
    openNoVNC(namespace: string, name: string): void {
        let url = "/assets/noVNC/vnc.html?resize=scale&autoconnect=1&path=";
        let path = "/k8s/apis/subresources.kubevirt.io/v1alpha3/namespaces/" + namespace + "/virtualmachineinstances/" + name + "/vnc";
        let fullpath = url + path;
        window.open(fullpath, "kubevirt-manager.io: CONSOLE", "width=800,height=600,location=no,toolbar=no,menubar=no,resizable=yes");
    }

    /*
     * Pool Basic Operations (start, stop, etc...)
     */
    async poolOperations(poolOperation: string, poolNamespace: string, poolName: string): Promise<void> {
        if(poolOperation == "start"){
            var data = await lastValueFrom(this.kubeVirtService.startPool(poolNamespace, poolName));
            this.myToasts.toastSuccess(this.pageName, "", "Started Pool: " + poolName);
            this.reloadComponent();
        } else if (poolOperation == "stop") {
            var data = await lastValueFrom(this.kubeVirtService.stopPool(poolNamespace, poolName));
            this.myToasts.toastSuccess(this.pageName, "", "Stopped Pool: " + poolName);
            this.reloadComponent();
        } else if (poolOperation == "delete") {
            const data = await lastValueFrom(this.kubeVirtService.deletePool(poolNamespace, poolName));
            this.myToasts.toastSuccess(this.pageName, "", "Deleted Pool: " + poolName);
            this.reloadComponent();
        }
    }

    /*
     * Show VM Strategy Window
     */
    async showRunStrategy(): Promise<void> {
        let modalDiv = document.getElementById("modal-runstrategy");
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Change VM Strategy
     */
    async applyStrategy(strategy: string): Promise<void> {
        try {
            const data = await lastValueFrom(this.kubeVirtService.changePoolStrategy(this.activePool.namespace, this.activePool.name, strategy));
            this.hideComponent("modal-type");
            this.myToasts.toastSuccess(this.pageName, "", "Edited VM Pool: " + this.activePool.name);
            this.reloadComponent();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, "", e.message);
            console.log(e);
        }
    }


    /*
     * Reload this component
     */
    reloadComponent(): void {
        this.router.navigateByUrl('/refresh',{skipLocationChange:true}).then(()=>{
            this.router.navigate([`/vmpooldetail/${this.poolNamespace}/${this.poolName}`]);
        })
    }

}
