import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { KubeVirtVM } from 'src/app/models/kube-virt-vm.model';
import { KubeVirtVMI } from 'src/app/models/kube-virt-vmi.model';
import { XK8sService } from 'src/app/services/x-k8s.service';
import { KClusterMachineDeployment } from 'src/app/models/kcluster-machine-deployment.model';
import { KClusterKubevirtMachineTemplate } from 'src/app/models/kcluster-kubevirt-machine-template.model';
import { KubeVirtService } from 'src/app/services/kube-virt.service';
import { Constants } from 'src/app/constants';

@Component({
  selector: 'app-kcluster-pool-details',
  templateUrl: './kcluster-pool-details.component.html',
  styleUrls: ['./kcluster-pool-details.component.css']
})
export class KClusterPoolDetailsComponent implements OnInit {

    myConstants!: Constants;
    poolName: string = "";
    poolNamespace: string = "";
    poolNetwork = {
        name: "",
        type: "",
        network: ""
    };

    customTemplate: boolean = false;

    activePool: KClusterMachineDeployment = new KClusterMachineDeployment;
    allWorkers: KubeVirtVM[] = [];

    hasClusterAutoscaler: boolean = false;    

    /* Disk Information */
    hasDisk1: boolean = false;
    hasDisk2: boolean = false;
    disk1Info = {
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

    disk2Info = {
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

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private xK8sService: XK8sService,
        private kubeVirtService: KubeVirtService
    ) { }

    async ngOnInit(): Promise<void> {
        this.poolName = this.route.snapshot.params['name'];
        this.poolNamespace = this.route.snapshot.params['namespace'];
        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren("Kubernetes Cluster - Pool Details");
        }
        this.myConstants = new Constants();
        await this.loadPoolDetails();
        await this.loadWorkerPoolsVMs();
    }

    /*
     * Load Pool Details
     */
    async loadPoolDetails(): Promise<void> {
        /* Loading MachineDeployments information */
        let thisWorker = await lastValueFrom(this.xK8sService.getMachineDeployment(this.poolNamespace, this.poolName));
        
        let thisWorkerPool = new KClusterMachineDeployment();
        thisWorkerPool.name = thisWorker.metadata.name;
        thisWorkerPool.namespace = thisWorker.metadata.namespace;
        thisWorkerPool.creationTimestamp = new Date(thisWorker.metadata.creationTimestamp);
        if(thisWorker.metadata.labels != null) {
            thisWorkerPool.labels = thisWorker.metadata.labels;
        }
        if(thisWorker.metadata.annotations != null) {
            thisWorkerPool.annotations = thisWorker.metadata.annotations;
        }
        thisWorkerPool.clusterName = thisWorker.spec.clusterName;
        thisWorkerPool.replicas = thisWorker.spec.replicas;
        thisWorkerPool.readyReplicas = thisWorker.status.readyReplicas;
        thisWorkerPool.version = thisWorker.spec.template.spec.version;

        thisWorkerPool.phase = thisWorker.status.phase;

        try {
            if(thisWorker.metadata.labels[this.myConstants.KubevirtManagerClusterAutoscaler] == "true") {
                this.hasClusterAutoscaler = true;
            }
        } catch (e) {
            this.hasClusterAutoscaler = false;
            console.log("No autoscaler");
        }

        if(this.hasClusterAutoscaler) {
            try {
                thisWorkerPool.minReplicas = Number(thisWorker.metadata.annotations[this.myConstants.KubevirtManagerClusterAutoscalerMin]);
                thisWorkerPool.maxReplicas = Number(thisWorker.metadata.annotations[this.myConstants.KubevirtManagerClusterAutoscalerMax]);               
            } catch (e) {
                this.hasClusterAutoscaler = false;
                console.log(e);
            }
        }

        /* Loading Machine Template */
        let workertemplate = await lastValueFrom(this.xK8sService.getKubevirtMachineTemplate(thisWorker.spec.template.spec.infrastructureRef.namespace, thisWorker.spec.template.spec.infrastructureRef.name));
        let thisWorkerTemplate = new KClusterKubevirtMachineTemplate;
        thisWorkerTemplate.name = workertemplate.metadata.name;
        thisWorkerTemplate.namespace = workertemplate.metadata.namespace;
        
        /* labels */
        if(workertemplate.metadata.labels != null) {
            thisWorkerTemplate.labels = workertemplate.metadata.labels;
        }

        /* Getting VM Type */
        try {
            thisWorkerTemplate.instType = workertemplate.spec.template.spec.virtualMachineTemplate.spec.instancetype.name;
        } catch(e: any) {
            thisWorkerTemplate.instType = "custom";
            this.customTemplate = true;
            console.log(e);
        }

        if(thisWorkerTemplate.instType == "custom") {
            this.customTemplate = true;
            try {
                /* Custom VM has cpu / mem parameters */
                thisWorkerTemplate.cores = workertemplate.spec.template.spec.virtualMachineTemplate.spec.domain.cpu["cores"];
                thisWorkerTemplate.sockets = workertemplate.spec.template.spec.virtualMachineTemplate.spec.domain.cpu["sockets"];
                thisWorkerTemplate.threads = workertemplate.spec.template.spec.virtualMachineTemplate.spec.domain.cpu["threads"];
                thisWorkerTemplate.memory = workertemplate.spec.template.spec.virtualMachineTemplate.spec.domain.resources.requests["memory"];
            } catch (e: any){
                thisWorkerTemplate.cores = thisWorkerTemplate.cores || 0;
                thisWorkerTemplate.sockets = thisWorkerTemplate.sockets || 0;
                thisWorkerTemplate.threads = thisWorkerTemplate.threads || 0;
                thisWorkerTemplate.memory = thisWorkerTemplate.memory || "N/A";
                console.log(e);
            }

        } else {
            /* load vCPU / Mem from type */
            try {
                const data = await lastValueFrom(this.kubeVirtService.getClusterInstanceType(thisWorkerTemplate.instType));
                thisWorkerTemplate.cores = data.spec.cpu["guest"];
                thisWorkerTemplate.memory = data.spec.memory["guest"];
                thisWorkerTemplate.sockets = 1;
                thisWorkerTemplate.threads = 1;
            } catch (e: any) {
                thisWorkerTemplate.sockets = 0;
                thisWorkerTemplate.threads = 0;
                thisWorkerTemplate.cores = 0;
                thisWorkerTemplate.memory = "";
                console.log(e);
            }
        }

        /* try {
            if(workertemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.firmware.bootloader.bios != null) {
                thisWorkerTemplate.firmware = "bios";
            }
        } catch (e: any) {
            thisWorkerTemplate.firmware = "";
        }

        try {
            if(workertemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.firmware.bootloader.efi != null) {
                thisWorkerTemplate.firmware = "efi";
            }
        } catch (e: any) {
            thisWorkerTemplate.firmware = "";
        }

        if(thisWorkerTemplate.firmware == "efi") {
            try {
                if(workertemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.firmware.bootloader.efi.secureBoot == true) {
                    thisWorkerTemplate.secureBoot = true;
                } else {
                    thisWorkerTemplate.secureBoot = false;
                }
            } catch(e: any) {
                thisWorkerTemplate.secureBoot = false;
            }
        } */

        thisWorkerTemplate.clusterName = workertemplate.metadata.ownerReferences[0].name;
        try {
            thisWorkerTemplate.priorityClass = workertemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.priorityClassName;
        } catch (e: any) {
            thisWorkerTemplate.priorityClass = "";
            console.log(e);
        }

        this.poolNetwork.name = workertemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.devices.interfaces[0].name;
        try {
            if(workertemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.networks[0].multus) {
                this.poolNetwork.network = workertemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.networks[0].multus.networkName;
            } else {
                this.poolNetwork.network = "podNetwork";
            }
        } catch (e: any) {
            this.poolNetwork.network = "podNetwork";
            console.log(e);
        }

        try {
            if(workertemplate.spec.template.spec.virtualMachineTemplate.spec.template.spec.domain.devices.interfaces[0].masquerade != null) {
                this.poolNetwork.type = "masquerade";
            } else {
                this.poolNetwork.type = "bridge";
            }
        } catch (e: any) {
            this.poolNetwork.type = "bridge";
            console.log(e);
        }

        /* Load Disks */
        this.loadDiskInfo(workertemplate.spec.template.spec.virtualMachineTemplate);

        thisWorkerPool.machineTemplate = thisWorkerTemplate;
        this.activePool = thisWorkerPool;
    }

    /*
     * Load Worker VM List
     */
    async loadWorkerPoolsVMs(): Promise<void> {

        let nodePoolName = this.activePool.name;
        let nodePoolNamespace = this.activePool.namespace;
        let currentVm = new KubeVirtVM;
        try {
            const data = await lastValueFrom(this.xK8sService.getMachineDeploymentNodes(nodePoolNamespace, nodePoolName));
            let vms = data.items;
            for (let i = 0; i < vms.length; i++) {
                currentVm = new KubeVirtVM();
                currentVm.name = vms[i].metadata["name"];
                currentVm.namespace = vms[i].metadata["namespace"];
                currentVm.creationTimestamp = new Date(vms[i].metadata["creationTimestamp"]);
                try {
                    currentVm.status = vms[i].status["printableStatus"].toLowerCase();
                    /* Working around a bug when scaling down and VM stuck in terminating */
                    if(currentVm.status.toLowerCase() == "terminating") {
                        currentVm.running = false;
                    } else if (currentVm.status.toLowerCase() == "running") {
                        currentVm.running = true;
                    } else {
                        currentVm.running = vms[i].spec["running"];
                    }
                } catch (e: any) {
                    currentVm.status = "";
                    currentVm.running = false;
                    console.log(e);
                }
                try {
                    if(vms[i].spec.template.spec.nodeSelector) {
                        currentVm.nodeSel = vms[i].spec.template.spec.nodeSelector[this.myConstants.KubernetesHostname];
                    } else {
                        currentVm.nodeSel = "auto-select";
                    }
                } catch (e: any) {
                    currentVm.nodeSel = "auto-select";
                    console.log(e);
                }

                /* Getting VM Type */
                try {
                    currentVm.instType = vms[i].spec.instancetype.name;
                } catch(e: any) {
                    currentVm.instType = "custom";
                    console.log(e);
                }

                if(currentVm.instType == "custom") {
                    try {
                        /* Custom VM has cpu / mem parameters */
                        currentVm.cores = vms[i].spec.template.spec.domain.cpu["cores"];
                        currentVm.sockets = vms[i].spec.template.spec.domain.cpu["sockets"];
                        currentVm.threads = vms[i].spec.template.spec.domain.cpu["threads"];
                        currentVm.memory = vms[i].spec.template.spec.domain.resources.requests["memory"];
                    } catch (e: any) {
                        currentVm.cores = currentVm.cores || 0;
                        currentVm.sockets = currentVm.sockets || 0;
                        currentVm.threads = currentVm.threads || 0;
                        currentVm.memory = currentVm.memory || "N/A";
                        console.log(e);
                    }

                } else {
                    /* load vCPU / Mem from type */
                    try {
                        const data = await lastValueFrom(this.kubeVirtService.getClusterInstanceType(currentVm.instType));
                        currentVm.cores = data.spec.cpu["guest"];
                        currentVm.memory = data.spec.memory["guest"];
                        currentVm.sockets = 1;
                        currentVm.threads = 1;
                    } catch (e: any) {
                        currentVm.sockets = 0;
                        currentVm.threads = 0;
                        currentVm.cores = 0;
                        currentVm.memory = "";
                        console.log(e);
                    }
                }

                if(vms[i].status["ready"] != null) {
                    currentVm.ready = vms[i].status["ready"];
                }

                if(currentVm.running && currentVm.status && vms[i].status["printableStatus"].toLowerCase() == "running") {
                    let currentVmi = new KubeVirtVMI;
                    try {
                        const datavmi = await lastValueFrom(this.kubeVirtService.getVMi(currentVm.namespace, currentVm.name));
                        currentVmi = new KubeVirtVMI();
                        currentVmi.name = datavmi.metadata["name"];
                        currentVmi.namespace = datavmi.metadata["namespace"];
                        currentVmi.creationTimestamp = new Date(datavmi.metadata["creationTimestamp"]);
                        currentVmi.osId = datavmi.status.guestOSInfo["id"]
                        currentVmi.osKernRel = datavmi.status.guestOSInfo["kernelRelease"]
                        currentVmi.osKernVer = datavmi.status.guestOSInfo["kernelVersion"]
                        currentVmi.osName = datavmi.status.guestOSInfo["name"]
                        currentVmi.osPrettyName = datavmi.status.guestOSInfo["prettyName"];
                        currentVmi.osVersion = datavmi.status.guestOSInfo["version"]

                        /* Only works with guest-agent installed if not on podNetwork */
                        try {
                            currentVm.nodeSel = datavmi.status["nodeName"];
                            /* In case of dual NIC, test which one is providing IP */
                            if(datavmi.status.interfaces[0]["ipAddress"] != null) {                        
                                currentVmi.ifAddr = datavmi.status.interfaces[0]["ipAddress"];
                                currentVmi.ifName = datavmi.status.interfaces[0]["name"];
                            } else {
                                currentVmi.ifAddr = datavmi.status.interfaces[1]["ipAddress"];
                                currentVmi.ifName = datavmi.status.interfaces[1]["name"];
                            }
                        } catch(e: any) {
                            currentVmi.ifAddr = "";
                            currentVmi.ifName = "";
                            console.log(e);
                        }

                        currentVmi.nodeName = datavmi.status["nodeName"];
                        currentVm.vmi = currentVmi;
                    } catch (e: any) {
                        console.log(e);
                        console.log("ERROR Retrieving VMI: " + currentVm.name + "-" + currentVm.namespace + ":" + currentVm.status);
                    }
                }
                this.activePool.vmlist.push(currentVm);
                this.allWorkers.push(currentVm);
            }
        } catch (e: any) {
            console.log(e);
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
            }

            /* Set the flag, and load disk info */
            if(thisDiskInfo.name == "disk1") {
                this.hasDisk1 = true;
                this.disk1Info = thisDiskInfo;
            } else if (thisDiskInfo.name == "disk2") {
                this.hasDisk2 = true;
                this.disk2Info = thisDiskInfo;
            }
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
     * VM Basic Operations (start, stop, etc...)
     */
    async vmOperations(vmOperation: string, vmNamespace: string, vmName: string): Promise<void> {
        if(vmOperation == "start"){
            var data = await lastValueFrom(this.kubeVirtService.startVm(vmNamespace, vmName));
            this.reloadComponent();
        } else if (vmOperation == "stop") {
            var data = await lastValueFrom(this.kubeVirtService.stopVm(vmNamespace, vmName));
            this.reloadComponent();
        } else if (vmOperation == "reboot"){
            var data = await lastValueFrom(this.kubeVirtService.restartVm(vmNamespace, vmName));
            this.reloadComponent();
        } else if (vmOperation == "delete") {
            const data = await lastValueFrom(this.kubeVirtService.deleteVm(vmNamespace, vmName));
            this.reloadComponent();
        }
    }

    /*
     * Show Worker Pool Replicas Window
     */
    showReplicas(wpNamespace: string, wpName: string, wpReplicas: number): void {
        let modalDiv = document.getElementById("modal-wp-replicas");
        let modalTitle = document.getElementById("replicas-wp-title");
        let nameField = document.getElementById("replicas-wp-name");
        let namespaceField = document.getElementById("replicas-wp-namespace");
        let replicasField = document.getElementById("replicas-wp-input");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Scale: " + wpNamespace + " - " + wpName);
        }
        if(nameField != null && namespaceField != null && replicasField != null) {
            nameField.setAttribute("value", wpName);
            namespaceField.setAttribute("value", wpNamespace);
            replicasField.setAttribute("placeholder", wpReplicas.toString());
            replicasField.setAttribute("value", wpReplicas.toString());
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
     * Perform Resize of Worker Pool
     */
    async applyReplicas(replicasSize: string): Promise<void> {
        let nameField = document.getElementById("replicas-wp-name");
        let namespaceField = document.getElementById("replicas-wp-namespace");
        if(replicasSize != null && nameField != null && namespaceField != null) {
            let wpNamespace = namespaceField.getAttribute("value");
            let wpName = nameField.getAttribute("value");
            if(replicasSize != null && wpName != null && wpNamespace != null) {
                try {
                    const data = await lastValueFrom(this.xK8sService.scaleMachineDeployment(wpNamespace, wpName, replicasSize));
                    this.hideComponent("modal-replicas-wp");
                    this.reloadComponent();
                } catch (e: any) {
                    alert(e.error.message);
                    console.log(e);
                }
            }
        }
    }

    /*
     * Show Worker Pool Autoscaling Window
     */
    showAutoscaling(wpNamespace: string, wpName: string, wpMin: number, wpMax: number): void {
        let modalDiv = document.getElementById("modal-wp-autoscaling");
        let modalTitle = document.getElementById("autoscaling-wp-title");
        let nameField = document.getElementById("autoscaling-wp-name");
        let namespaceField = document.getElementById("autoscaling-wp-namespace");
        let minField = document.getElementById("min-wp-input");
        let maxField = document.getElementById("max-wp-input");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Autoscaling: " + wpNamespace + " - " + wpName);
        }

        if(minField != null && maxField != null) {
            minField.textContent = wpMin.toString();
            maxField.textContent = wpMax.toString();

            minField.setAttribute("value", wpMin.toString());
            maxField.setAttribute("value", wpMax.toString())

        }

        if(nameField != null && namespaceField != null) {
            nameField.setAttribute("value", wpName);
            namespaceField.setAttribute("value", wpNamespace);
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
     * Perform Autoscaling change on Worker Pool
     */
    async applyAutoscaling(min: string, max: string): Promise<void> {
        let nameField = document.getElementById("replicas-wp-name");
        let namespaceField = document.getElementById("replicas-wp-namespace");
        if(min != null && max != null && nameField != null && namespaceField != null) {
            let wpNamespace = namespaceField.getAttribute("value");
            let wpName = nameField.getAttribute("value");
            if(wpName != null && wpNamespace != null) {
                try {
                    const data = await lastValueFrom(this.xK8sService.updatePoolAutoscaling(wpNamespace, wpName, min, max));
                    this.hideComponent("modal-replicas-wp");
                    this.reloadComponent();
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
     * Reload this component
     */
    reloadComponent(): void {
        this.router.navigateByUrl('/refresh',{skipLocationChange:true}).then(()=>{
            this.router.navigate([`/kclusterpooldetails/${this.poolNamespace}/${this.poolName}`]);
        })
    }

}
