import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { KubeVirtVM } from 'src/app/models/kube-virt-vm.model';
import { DataVolumesService } from 'src/app/services/data-volumes.service';
import { K8sApisService } from 'src/app/services/k8s-apis.service';
import { KubeVirtService } from 'src/app/services/kube-virt.service';
import { PrometheusService } from 'src/app/services/prometheus.service';
import { Chart } from 'chart.js/auto'
import { KubeVirtVMI } from 'src/app/models/kube-virt-vmi.model';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { VMDisk } from 'src/app/models/vmdisk.model';
import { VMNewtork } from 'src/app/models/vmnewtork.model';
import { removeVolumeOptions } from 'src/app/interfaces/removeVolumeOptions';
import { addVolumeOptions } from 'src/app/interfaces/addVolumeOptions';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { Toasts } from 'src/app/classes/toasts';


@Component({
  selector: 'app-vmdetails',
  templateUrl: './vmdetails.component.html',
  styleUrls: ['./vmdetails.component.css']
})
export class VmdetailsComponent implements OnInit {

    pageName: string = "Virtual Machine Details";

    myToasts!: Toasts;
    vmName: string = "";
    vmNamespace: string = "";
    activeVm: KubeVirtVM = new KubeVirtVM;
    customTemplate: boolean = false;
    urlSafeVnc: SafeResourceUrl = "";
    urlSafeXterm: SafeResourceUrl = "";
    promCheck: boolean = false;

    myInterval = setInterval(() =>{ this.reloadChartsAndLogs(); }, 120000);

    /* Prometheus query data */
    promStartTime = 0;
    promEndTime = 0;
    promInterval = 3600; // Prometheus Window 30 minutes
    promStep = 30;       // Prometheus Step 20 seconds

    /* Chart.JS placeholder */
    cpuChart: any;
    memChart: any;
    netChart: any;
    stgChart: any;

    /*
     * Dynamic Forms
     */
    diskList: FormGroup;

    /* Console Reader */
    consoleMessages: Array<string> = new Array();
    newConsoleMessages: { text: string, style: string }[] = [];

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private sanitizer: DomSanitizer,
        private k8sApisService: K8sApisService,
        private dataVolumesService: DataVolumesService,
        private prometheusService: PrometheusService,
        private kubeVirtService: KubeVirtService,
        private cdRef: ChangeDetectorRef,
        private fb: FormBuilder
    ) {
        this.diskList = this.fb.group({
            disks: this.fb.array([]),
        });
    }

    async ngOnInit(): Promise<void> {
        this.vmName = this.route.snapshot.params['name'];
        this.vmNamespace = this.route.snapshot.params['namespace'];

        this.diskList = this.fb.group({
            disks: this.fb.array([]),
        });

        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren(this.pageName);
        }
        this.myToasts = new Toasts();
        await this.loadVm();
        await this.loadPrometheus();
        await this.loadSerialLog();
        this.loadXterm();
        this.loadNoVNC();
    }

    /*
     * Serial Log
     */
    async loadSerialLog(): Promise<void> {
        let podName = "";
        this.newConsoleMessages = [];
        try {
            let data = await lastValueFrom(this.kubeVirtService.findVMPod(this.vmNamespace, this.activeVm.vmi.uid));
            podName = data.items[0].metadata["name"];
            data = await lastValueFrom(this.kubeVirtService.getVMSerialLog(this.vmNamespace, podName));
            data = data.replace(/\n/g, '<br />\n');
            for (const line of data.split(/[\r\n]+/)){
                this.parseAnsiLog(line);
            }
            
        } catch (e: any) {
            console.log("Error loading serial log....");
            console.log(e);
        }
    }

    /*
     * Ansi chars parser
     */
    private parseAnsiLog(log: string) {
        const ansiRegex = /\x1b\[((?:\d|;)*)([a-zA-Z])/g;
        let lastIndex = 0;
        let currentStyle = 'color:#dadada;';
        
        log.replace(ansiRegex, (match, codes, letter, offset) => {
            // Push the text before the ANSI code
            this.newConsoleMessages.push({
                text: log.substring(lastIndex, offset),
                style: currentStyle
            });
            
            lastIndex = offset + match.length;
            
            // Process ANSI codes
            const codeList = codes.split(';').map(Number);
            for (const code of codeList) {
                currentStyle = this.applyAnsiCode(code, currentStyle);
            }
            return ''; // This is just to satisfy the replace function
        });
        
        // Push the remaining text after the last ANSI code
        this.newConsoleMessages.push({
            text: log.substring(lastIndex),
            style: currentStyle
        });
    }
    
    /*
     * ANSI to CSS codes
     */
    private applyAnsiCode(code: number, currentStyle: string): string {
        switch (code) {
            case 0: return 'color:#dadada;'; // Reset
            case 1: return currentStyle + 'font-weight:bold;'; // Bold
            case 3: return currentStyle + 'font-style:italic;'; // Italic
            case 4: return currentStyle + 'text-decoration:underline;'; // Underline
            case 30: return 'color:black;';
            case 31: return 'color:red;';
            case 32: return 'color:green;';
            case 33: return 'color:yellow;';
            case 34: return 'color:blue;';
            case 35: return 'color:magenta;';
            case 36: return 'color:cyan;';
            case 37: return 'color:white;';
            // Add more codes as needed
            default: return currentStyle;
        }
    }

    /* Getting the Disks FormArray */
    get disks(): FormArray {
        return this.diskList.get('disks') as FormArray;
    }

    /* Disk FormGroup */
    createDiskGroup(diskName: string, bootOrder: number, diskBus: string): FormGroup {
        return this.fb.group({
            diskName: [diskName],
            diskBootOrder: [bootOrder],
            diskBus: [diskBus]
        });
    }

    /* Add a new Disk entry to the Group */
    async addDisk(diskName: string, bootOrder: number, diskBus: string): Promise<void> {
        this.disks.push(this.createDiskGroup(diskName, bootOrder, diskBus));
    }

    /* Remove Disk entry from the Group */
    removeDisk(index: number): void {
        this.disks.removeAt(index);
    }

    /* Getting all the Disks */
    getDisks(): any[] {
        return this.diskList.value.disks;
    }

    /*
     * Load Prometheus Metrics
     */
    async loadPrometheus(): Promise<void>  {
        try {
            const data = await lastValueFrom(this.prometheusService.checkPrometheus());
            if(data["status"].toLowerCase() == "success") {
                this.promCheck = true;
                await this.getTimestamps();
                this.cpuGraph();
                this.memGraph();
                this.netGraph();
                this.stgGraph();
            } else {
                this.promCheck = false;
            }
        } catch (e: any) {
            this.promCheck = false;
            console.log("No prometheus...");
        }
    }

    /*
     * Reload Prometheus Metrics
     */
    async reloadPrometheus(): Promise<void>  {
        try {
            const data = await lastValueFrom(this.prometheusService.checkPrometheus());
            if(data["status"].toLowerCase() == "success") {
                this.promCheck = true;
                await this.getTimestamps();
                this.cpuGraphReload();
                this.memGraphReload();
                this.netGraphReload();
                this.stgGraphReload();
            } else {
                this.promCheck = false;
            }
        } catch (e: any) {
            this.promCheck = false;
            console.log("No prometheus...");
        }
    }

    /*
     * Generate timestamps for Prometheus Query
     */
    async getTimestamps(): Promise<void>  {
        this.promEndTime = Math.floor(Date.now() / 1000)
        this.promStartTime = this.promEndTime - this.promInterval;
    }

    /*
     * Reload cpu data
     */
    async cpuGraphReload(): Promise<void> {
        /* get CPU data from Prometheus */
        let response = await lastValueFrom(this.prometheusService.getVMCpuSummary(this.vmName, this.vmNamespace, this.promStartTime, this.promEndTime, this.promStep));
        let data = response.data.result[0].values;

        /* prepare Data for Graph */
        let cpuData = data.map(function(value: any[],index: any) { return value[1] * 10; });
        let labelData = Array(cpuData.length).fill("");

        this.cpuChart.data.labels = labelData;
        this.cpuChart.data.datasets[0].data = cpuData;

        this.cpuChart.update();
    }

    /*
     * Generate CPU Graph
     */
    async cpuGraph(): Promise<void> {
        let maxCpu = this.activeVm.cores * this.activeVm.sockets * this.activeVm.threads;

        /* get CPU data from Prometheus */
        let response = await lastValueFrom(this.prometheusService.getVMCpuSummary(this.vmName, this.vmNamespace, this.promStartTime, this.promEndTime, this.promStep));
        let data = response.data.result[0].values;

        /* prepare Data for Graph */
        let cpuData = data.map(function(value: any[],index: any) { return value[1] * 10; });

        let labelData = Array(cpuData.length).fill("");

        this.cpuChart = new Chart("CpuChart", {
            type: 'line',
            data: {
              labels: labelData, 
                 datasets: [
                {
                  label: "CPU Usage",
                  pointRadius: 1,
                  pointBorderWidth: 0,
                  tension: 1,
                  borderWidth: 3,
                  data: cpuData,
                  backgroundColor: 'blue',
                  borderColor: 'blue',
                  fill: true
                }  
              ]
            },
            options: {
              aspectRatio:5,
              animations: {
                tension: {
                  duration: 1000,
                  easing: 'linear',
                  from: 1,
                  to: 0,
                  loop: false
                }
              },
              scales: {
                x: {
                    grid: {
                      display: false
                    }
                  },
                  y: {
                    min: 0,
                    max: maxCpu + 1,
                    grid: {
                      display: true
                    }
                  }
              }
            }
            
        });
    }

     /*
     * Reload Memory Data
     */
     async memGraphReload(): Promise<void> {
        /* get Memory data from Prometheus */
        let response = await lastValueFrom(this.prometheusService.getVMMemSummary(this.vmName, this.vmNamespace, this.promStartTime, this.promEndTime, this.promStep));
        let data = response.data.result[0].values;

        /* prepare Data for Graph */
        let memData = data.map(function(value: any[],index: any) { return value[1]; });
        let labelData = Array(memData.length).fill("");

        this.memChart.data.labels = labelData;
        this.memChart.data.datasets[0].data = memData;

        this.memChart.update();

    }

    /*
     * Generate Memory Graph
     */
    async memGraph(): Promise<void> {
        /* get Memory data from Prometheus */
        let response = await lastValueFrom(this.prometheusService.getVMMemSummary(this.vmName, this.vmNamespace, this.promStartTime, this.promEndTime, this.promStep));
        let data = response.data.result[0].values;

        /* prepare Data for Graph */
        let memData = data.map(function(value: any[],index: any) { return value[1]; });
        let labelData = Array(memData.length).fill("");

        this.memChart = new Chart("MemChart", {
            type: 'line',
            data: {
              labels: labelData, 
                 datasets: [
                {
                  label: "Mem Usage",
                  pointRadius: 1,
                  pointBorderWidth: 0,
                  tension: 1,
                  borderWidth: 3,
                  data: memData,
                  backgroundColor: 'green',
                  borderColor: 'green',
                  fill: true
                }  
              ]
            },
            options: {
              aspectRatio:5,
              animations: {
                tension: {
                  duration: 1000,
                  easing: 'linear',
                  from: 1,
                  to: 0,
                  loop: false
                }
              },
              scales: {
                x: {
                    grid: {
                      display: false
                    }
                  },
                  y: {
                    min: 0,
                    max: (Number.parseInt(this.activeVm.memory.split("Gi")[0]) * 1024) + 1024,
                    grid: {
                      display: true
                    }
                  }
              }
            }
            
        });

    }

    /*
     * Reload Network Data
     */
    async netGraphReload(): Promise<void> {
        /* get Network Sent data from Prometheus */
        let response = await lastValueFrom(this.prometheusService.getVMNetSent(this.vmName, this.vmNamespace, this.promStartTime, this.promEndTime, this.promStep));
        let data = response.data.result[0].values;

        /* prepare Sent Data for Graph */
        let sentData = data.map(function(value: any[],index: any) { return value[1]; });

        let i = 0;

        /* Convert sent data to kbytes */
        for(i = 0; i < sentData.length; i++) {
            sentData[i] = (sentData[i]/1024)/1024;
        }

        /* get Network Received data from Prometheus */
        response = await lastValueFrom(this.prometheusService.getVMNetRecv(this.vmName, this.vmNamespace, this.promStartTime, this.promEndTime, this.promStep));
        data = response.data.result[0].values;

        /* prepare Received Data for Graph */
        let recvData = data.map(function(value: any[],index: any) { return value[1]; });

        /* Convert received data to kbytes */
        for(i = 0; i < recvData.length; i++) {
            recvData[i] = (recvData[i]/1024)/1024;
        }

        let labelData = Array(sentData.length).fill("");

        this.netChart.data.labels = labelData;
        this.netChart.data.datasets[0].data = sentData;
        this.netChart.data.datasets[1].data = recvData;

        this.netChart.update();
    }

    /*
     * Generate Network Graph (bytes)
     */
    async netGraph(): Promise<void> {
        /* get Network Sent data from Prometheus */
        let response = await lastValueFrom(this.prometheusService.getVMNetSent(this.vmName, this.vmNamespace, this.promStartTime, this.promEndTime, this.promStep));
        let data = response.data.result[0].values;

        /* prepare Sent Data for Graph */
        let sentData = data.map(function(value: any[],index: any) { return value[1]; });

        let i = 0;

        /* Convert sent data to kbytes */
        for(i = 0; i < sentData.length; i++) {
            sentData[i] = (sentData[i]/1024)/1024;
        }

        /* get Network Received data from Prometheus */
        response = await lastValueFrom(this.prometheusService.getVMNetRecv(this.vmName, this.vmNamespace, this.promStartTime, this.promEndTime, this.promStep));
        data = response.data.result[0].values;

        /* prepare Received Data for Graph */
        let recvData = data.map(function(value: any[],index: any) { return value[1]; });

        /* Convert received data to kbytes */
        for(i = 0; i < recvData.length; i++) {
            recvData[i] = (recvData[i]/1024)/1024;
        }

        let labelData = Array(sentData.length).fill("");

        this.netChart = new Chart("NetChart", {
            type: 'line',
            data: {
              labels: labelData, 
                 datasets: [
                {
                  label: "Sent",
                  data: sentData,
                  pointRadius: 1,
                  pointBorderWidth: 0,
                  tension: 1,
                  borderWidth: 3,
                  borderColor: 'green',
                  backgroundColor: 'green'
                },
                {
                  label: "Recv",
                  data: recvData,
                  pointRadius: 1,
                  pointBorderWidth: 0,
                  tension: 1,
                  borderWidth: 3,
                  borderColor: 'blue',
                  backgroundColor: 'blue'
                }
              ]
            },
            options: {
                aspectRatio:5,
                animations: {
                  tension: {
                    duration: 1000,
                    easing: 'linear',
                    from: 1,
                    to: 0,
                    loop: false
                  }
                },
                scales: {
                  x: {
                      grid: {
                        display: false
                      }
                    },
                    y: {
                      min: 0,
                      grid: {
                        display: true
                      }
                    }
                }
              }
            
        });

    }

    /*
     * Reload Storage Data
     */
    async stgGraphReload(): Promise<void> {
        /* get Storage Read data from Prometheus */
        let response = await lastValueFrom(this.prometheusService.getVMStorageRead(this.vmName, this.vmNamespace, this.promStartTime, this.promEndTime, this.promStep));
        let data = response.data.result[0].values;

        /* prepare Read Data for Graph */
        let readData = data.map(function(value: any[],index: any) { return value[1]; });

        let i = 0;

        /* Convert read data to mbytes */
        for(i = 0; i < readData.length; i++) {
            readData[i] = (readData[i]/1024)/1024;
        }

        /* get Storage Write data from Prometheus */
        response = await lastValueFrom(this.prometheusService.getVMStorageWrite(this.vmName, this.vmNamespace, this.promStartTime, this.promEndTime, this.promStep));
        data = response.data.result[0].values;

        /* prepare Write Data for Graph */
        let writeData = data.map(function(value: any[],index: any) { return value[1]; });

        /* Convert write data to mbytes */
        for(i = 0; i < writeData.length; i++) {
            writeData[i] = (writeData[i]/1024)/1024;
        }

        let labelData = Array(readData.length).fill("");

        this.stgChart.data.labels = labelData;
        this.stgChart.data.datasets[0].data = readData;
        this.stgChart.data.datasets[1].data = writeData;

        this.stgChart.update();
    }

    /*
     * Generate Storage Graph (bytes)
     */
    async stgGraph(): Promise<void> {
        /* get Storage Read data from Prometheus */
        let response = await lastValueFrom(this.prometheusService.getVMStorageRead(this.vmName, this.vmNamespace, this.promStartTime, this.promEndTime, this.promStep));
        let data = response.data.result[0].values;

        /* prepare Read Data for Graph */
        let readData = data.map(function(value: any[],index: any) { return value[1]; });

        let i = 0;

        /* Convert read data to mbytes */
        for(i = 0; i < readData.length; i++) {
            readData[i] = (readData[i]/1024)/1024;
        }

        /* get Storage Write data from Prometheus */
        response = await lastValueFrom(this.prometheusService.getVMStorageWrite(this.vmName, this.vmNamespace, this.promStartTime, this.promEndTime, this.promStep));
        data = response.data.result[0].values;

        /* prepare Write Data for Graph */
        let writeData = data.map(function(value: any[],index: any) { return value[1]; });

        /* Convert write data to mbytes */
        for(i = 0; i < writeData.length; i++) {
            writeData[i] = (writeData[i]/1024)/1024;
        }

        let labelData = Array(readData.length).fill("");

        this.stgChart = new Chart("StgChart", {
            type: 'line',
            data: {
              labels: labelData, 
                 datasets: [
                {
                  label: "Read",
                  data: readData,
                  pointRadius: 1,
                  pointBorderWidth: 0,
                  tension: 1,
                  borderWidth: 3,
                  borderColor: 'green',
                  backgroundColor: 'green'
                },
                {
                  label: "Write",
                  data: writeData,
                  pointRadius: 1,
                  pointBorderWidth: 0,
                  tension: 1,
                  borderWidth: 3,
                  borderColor: 'blue',
                  backgroundColor: 'blue'
                  }
              ]
            },
            options: {
                aspectRatio:5,
                animations: {
                  tension: {
                    duration: 1000,
                    easing: 'linear',
                    from: 1,
                    to: 0,
                    loop: false
                  }
                },
                scales: {
                  x: {
                      grid: {
                        display: false
                      }
                    },
                    y: {
                      min: 0,
                      grid: {
                        display: true
                      }
                    }
                }
              }
            
        });

    }

    /*
     * Load VM
     */
    async loadVm(): Promise<void> {
        const data = await lastValueFrom(this.kubeVirtService.getVM(this.vmNamespace, this.vmName));

        this.activeVm = new KubeVirtVM();
        this.activeVm.name = data.metadata["name"];
        this.activeVm.namespace = data.metadata["namespace"];
        if(data.metadata.labels != null) {
            this.activeVm.labels = data.metadata.labels;
        }
        this.activeVm.creationTimestamp = new Date(data.metadata["creationTimestamp"]);
        if(data.spec["running"]) {
            this.activeVm.running = data.spec["running"];
        }
        if (data.status) {
            this.activeVm.printableStatus = data.status["printableStatus"].toLowerCase();
            if (this.activeVm.printableStatus.toLowerCase() == "running") {
                this.activeVm.running = true;
            }
        }
        try {
            this.activeVm.runStrategy = data.spec["runStrategy"];
        } catch (e: any) {
            this.activeVm.runStrategy = "";
            console.log("Error loading VM runStrategy");
        }

        /* Getting VM Type */
        try {
            if(data.spec.instancetype) {
                this.activeVm.instType = data.spec.instancetype.name;
                this.customTemplate = false;
            } else {
                this.activeVm.instType = "custom";
                this.customTemplate = true;
            }
        } catch(e: any) {
            this.activeVm.instType = "custom";
            this.customTemplate = true;
            console.log(e);
        }

        if(this.activeVm.instType == "custom") {
            /* Custom VM has cpu / mem parameters */
            this.activeVm.cores = data.spec.template.spec.domain.cpu["cores"];
            this.activeVm.sockets = data.spec.template.spec.domain.cpu["sockets"];
            this.activeVm.threads = data.spec.template.spec.domain.cpu["threads"];
            this.activeVm.memory = data.spec.template.spec.domain.resources.requests["memory"];
        } else {
            /* load vCPU / Mem from type */
            try {
                const data = await lastValueFrom(this.kubeVirtService.getClusterInstanceType(this.activeVm.instType));
                this.activeVm.cores = data.spec.cpu["guest"];
                this.activeVm.memory = data.spec.memory["guest"];
                this.activeVm.sockets = 1;
                this.activeVm.threads = 1;
            } catch (e: any) {
                this.activeVm.sockets = 0;
                this.activeVm.threads = 0;
                this.activeVm.cores = 0;
                this.activeVm.memory = "";
                console.log(e);
            }
        }
        try {
            this.activeVm.priorityClass = data.spec.template.spec.priorityClassName;
        } catch (e: any) {
            this.activeVm.priorityClass = "";
            console.log(e);
        }
        
        try {
            if(data.spec.template.spec.domain.firmware.bootloader.bios != null) {
                this.activeVm.firmware = "bios";
            }
        } catch (e: any) {
            this.activeVm.firmware = "";
        }

        try {
            if(data.spec.template.spec.domain.firmware.bootloader.efi != null) {
                this.activeVm.firmware = "efi";
            }
        } catch (e: any) {
            this.activeVm.firmware = "";
        }

        if(this.activeVm.firmware == "efi") {
            try {
                if(data.spec.template.spec.domain.firmware.bootloader.efi.secureBoot == true) {
                    this.activeVm.secureBoot = true;
                } else {
                    this.activeVm.secureBoot = false;
                }
            } catch(e: any) {
                this.activeVm.secureBoot = false;
            }
        }


        /* Loading Network Info */
        await this.loadNetInfo(data.spec.template.spec.domain.devices.interfaces, data.spec.template.spec.networks);

        if(this.activeVm.running && data.status && data.status["printableStatus"].toLowerCase() == "running") {
            let currentVmi = new KubeVirtVMI;
            try {
                const datavmi = await lastValueFrom(this.kubeVirtService.getVMi(this.activeVm.namespace, this.activeVm.name));
                currentVmi = new KubeVirtVMI();
                currentVmi.name = datavmi.metadata["name"];
                currentVmi.namespace = datavmi.metadata["namespace"];
                currentVmi.uid = datavmi.metadata["uid"];
                currentVmi.running = true;
                currentVmi.creationTimestamp = new Date(datavmi.metadata["creationTimestamp"]);
                currentVmi.osId = datavmi.status.guestOSInfo["id"];
                currentVmi.osKernRel = datavmi.status.guestOSInfo["kernelRelease"];
                currentVmi.osKernVer = datavmi.status.guestOSInfo["kernelVersion"];
                currentVmi.osName = datavmi.status.guestOSInfo["name"];
                currentVmi.osPrettyName = datavmi.status.guestOSInfo["prettyName"];
                currentVmi.osVersion = datavmi.status.guestOSInfo["version"];

                /* Only works with guest-agent installed if not on podNetwork */
                try {
                    this.activeVm.nodeSel = datavmi.status["nodeName"];
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

                for(let k = 0; k < datavmi.status.interfaces.length; k++) {
                    for(let l = 0; l < this.activeVm.networkList.length; l++) {
                        if(datavmi.status.interfaces[k].name == this.activeVm.networkList[l].name) {
                            this.activeVm.networkList[l].ip = datavmi.status.interfaces[k]["ipAddress"];
                        }
                    }
                }

                currentVmi.nodeName = datavmi.status["nodeName"];
                this.activeVm.vmi = currentVmi;

                /* Loading Disks from VMI */
                await this.loadDiskInfo(datavmi.spec.domain.devices.disks, datavmi.spec.volumes);

            } catch (e: any) {
                console.log(e);
                console.log("ERROR Retrieving VMI: " + this.activeVm.name + "-" + this.activeVm.namespace + ":" + this.activeVm.status);
            }

        } else {
            /* NO VMI, Loading Disks from VM */
            await this.loadDiskInfo(data.spec.template.spec.domain.devices.disks, data.spec.template.spec.volumes);
        }
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
                this.activeVm.networkList.push(netInfo);
            }
        }
    }

    /*
     * Load Disk Information
     */
    async loadDiskInfo(disks: any, volumes: any): Promise<void> {

        /* Find Disk */
        for (let i = 0; i < disks.length; i++) {

            let diskInfo: VMDisk = new VMDisk;
            diskInfo.id = i;
            diskInfo.name = disks[i].name;
            
            diskInfo.cacheMode = disks[i].cache;
            if(disks[i].disk.bus != "") {
                diskInfo.bus = disks[i].disk.bus;
            }
            if(diskInfo.cacheMode == null) {
                diskInfo.cacheMode = "N/A";
            }
            if(disks[i].bootOrder != 9999) {
                diskInfo.bootOrder = disks[i].bootOrder
            }

            let keys = Object.keys(disks[i]);
            for (let j = 0; j < keys.length; j++) {
                if(keys[j].toLowerCase() != "name") {
                    diskInfo.type = keys[j];
                }
            }
            /* Find Volume related to the Disk */
            for (let k = 0; k < volumes.length; k++) {
                if(volumes[k].name == diskInfo.name) {
                    let volume_keys = Object.keys(volumes[k]);
                    for(let l = 0; l < volume_keys.length; l++) {
                        if(volume_keys[l].toLowerCase() != "name") {
                            if(volume_keys[l].toLowerCase() == "datavolume") {
                                diskInfo.backend = volume_keys[l];
                                diskInfo.dataVolume.name = volumes[k].dataVolume.name;
                                diskInfo.dataVolume.namespace = this.activeVm.namespace;
                                if(volumes[k].dataVolume.hotpluggable == true) {
                                    diskInfo.hotplug = true;
                                }
                            } else if (volume_keys[l].toLowerCase().includes("cloudinit")) {
                                diskInfo.backend = volume_keys[l];
                                diskInfo.dataVolume.name = "N/A";
                                diskInfo.dataVolume.namespace = "N/A";
                            }
                        }
                    }
                }
            }

            this.addDisk(disks[i].name, disks[i].bootOrder, disks[i].disk.bus);

            try {
                /* Fetching Data Volume Template */
                if(diskInfo.backend.toLowerCase() == "datavolume") {
                    let dvdata = await lastValueFrom(this.dataVolumesService.getDataVolumeInfo(diskInfo.dataVolume.namespace, diskInfo.dataVolume.name));
                    diskInfo.namespace = dvdata.metadata.namespace;
                    diskInfo.dataVolume.namespace = dvdata.metadata.namespace;
                    try {
                        diskInfo.accessMode = dvdata.spec.pvc.accessModes[0];
                        diskInfo.size = dvdata.spec.pvc.resources.requests["storage"];
                        diskInfo.storageClass = dvdata.spec.pvc["storageClassName"];
                    } catch (e: any) {
                        diskInfo.accessMode = dvdata.spec.storage.accessModes[0];
                        diskInfo.size = dvdata.spec.storage.resources.requests["storage"];
                        diskInfo.storageClass = dvdata.spec.storage["storageClassName"];
                    }
                    let this_source_keys = Object.keys(dvdata.spec.source);
                    for(let k = 0; k <  this_source_keys.length; k++) {
                        let this_key = this_source_keys[k];
                        switch (this_key) {
                            case "blank": 
                                diskInfo.dataVolume.source = "blank";
                                diskInfo.dataVolume.sourceValue = "N/A";
                                break;
                            case "s3":
                                diskInfo.dataVolume.source = "s3";
                                diskInfo.dataVolume.sourceValue = dvdata.spec.source.s3.url;;
                                break;
                            case "gcs":
                                diskInfo.dataVolume.source = "gcs";
                                diskInfo.dataVolume.sourceValue = dvdata.spec.source.gcs.url;
                                break;
                            case "http":
                                diskInfo.dataVolume.source = "http";
                                diskInfo.dataVolume.sourceValue = dvdata.spec.source.http.url;
                                break;
                            case "registry":
                                diskInfo.dataVolume.source = "registry";
                                diskInfo.dataVolume.sourceValue = dvdata.spec.source.registry.url;
                                break;
                            case "pvc":
                                diskInfo.dataVolume.source = "pvc";
                                diskInfo.dataVolume.sourceValue = dvdata.spec.source.pvc.namespace + " - " + dvdata.spec.source.pvc.name;
                                break;
                        }
                    }
                } else if (diskInfo.backend.toLowerCase().includes("cloudinit")) {
                    diskInfo.accessMode = "N/A";
                    diskInfo.size = "N/A";
                    diskInfo.storageClass = "N/A";
                    diskInfo.dataVolume.source = "blank";
                    diskInfo.dataVolume.sourceValue = "N/A";
                }
                diskInfo.bound = true;
                this.activeVm.diskList.push(diskInfo);
            } catch (e: any) {
                console.log(e);
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
            const data = await lastValueFrom(this.kubeVirtService.changeVmStrategy(this.activeVm.namespace, this.activeVm.name, strategy));
            this.hideComponent("modal-type");
            this.myToasts.toastSuccess(this.pageName, "", "Edited Virtual Machine : " + this.activeVm.name);
            this.reloadComponent();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, "", e.message);
            console.log(e);
        }
    }

    /*
     * Show VM Type Window
     */
    async showType(): Promise<void> {
        let modalDiv = document.getElementById("modal-type");
        let selectorTypeFiled = document.getElementById("changevm-type");
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
     * Change VM Type
     */
    async applyType(type: string): Promise<void> {
        try {
            const data = await lastValueFrom(this.kubeVirtService.changeVmType(this.activeVm.namespace, this.activeVm.name, type));
            this.hideComponent("modal-type");
            this.myToasts.toastSuccess(this.pageName, "", "Edited Virtual Machine : " + this.activeVm.name);
            this.reloadComponent();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, "", e.message);
            console.log(e);
        }
    }

    /*
     * Show Unplug Volume
     */
    async showUnplug(volume: string): Promise<void> {
        let modalDiv = document.getElementById("modal-unplug");
        let unplugValue = document.getElementById("unplug-value");
        if (unplugValue != null) {
            unplugValue.innerHTML = "Are you sure you want to unplug volume <b>" + volume + "</b> from Virtual Machine <b>" + this.activeVm.namespace + ":" + this.activeVm.name + "?";
        }

        let unplugVolume= document.getElementById("unplug-volume");

        if (unplugVolume != null) {
            unplugVolume.setAttribute("value", volume);
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
     * Unplug Volume
     */
    async applyUnplug(): Promise<void> {
        let unplugVolume= document.getElementById("unplug-volume");
        if (unplugVolume != null) {
            let volume = unplugVolume.getAttribute("value");
            if(volume != null) {
                try {
                    let thisRemoveOptions: removeVolumeOptions = {
                        name: volume
                    };
                    const data = await lastValueFrom(this.kubeVirtService.unplugVolume(this.activeVm.namespace, this.activeVm.name, thisRemoveOptions));
                    this.hideComponent("modal-unplug");
                    this.myToasts.toastSuccess(this.pageName, "", "Edited Virtual Machine : " + this.activeVm.name);
                    this.reloadComponent();
                } catch (e: any) {
                    this.myToasts.toastError(this.pageName, "", e.message);
                    console.log(e);
                }
            }
        }
    }

    /*
     * Show Hotplug Window
     */
    async showHotplug(): Promise<void> {
        let modalDiv = document.getElementById("modal-hotplug");
        let selectorVolumeFiled = document.getElementById("hotplug-volume");
        let volumeSelectorOptions = "";
        let data = await lastValueFrom(await this.dataVolumesService.getNamespacedDataVolumes(this.activeVm.namespace));
        let disks = data.items;
        for (let i = 0; i < disks.length; i++) {
            volumeSelectorOptions += "<option value=" + disks[i].metadata["name"] +">" + disks[i].metadata["name"] + "</option>\n";
        }
        if (selectorVolumeFiled != null) {
            selectorVolumeFiled.innerHTML = volumeSelectorOptions;
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
     * Apply Hotplug
     */
    async applyHotplug(volume: string, type: string, cachemode: string, readonly: string): Promise<void> {
        let spec: any;

        if (readonly == "yes") {
            spec = {
                readonly: true
            };
        } else {
            spec = {
                readonly: false
            };
        }
        try {
            let thisAddVolumeOptions: addVolumeOptions = {
                name: volume,
                disk: {
                    name: volume,
                    serial: volume,
                    cache: cachemode
                },
                volumeSource: {
                    dataVolume: {
                        name: volume,
                        hotpluggable: true
                    }
                }
            };
            switch(type) {
                case "cdrom":
                            thisAddVolumeOptions.disk.cdrom = spec;
                            break;
                case "lun":
                            spec.bus = "scsi";
                            thisAddVolumeOptions.disk.lun = spec;
                            break;
                case "disk":
                            spec.bus = "scsi";
                            thisAddVolumeOptions.disk.disk = spec;
                            break;
            }
            const data = await lastValueFrom(this.kubeVirtService.plugVolume(this.activeVm.namespace, this.activeVm.name, thisAddVolumeOptions));
            this.hideComponent("modal-hotplug");
            this.myToasts.toastSuccess(this.pageName, "", "Edited Virtual Machine : " + this.activeVm.name);
            this.reloadComponent();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, "", e.message);
            console.log(e);
        }
    }

    /*
     * Show Hotplug Window
     */
    async showDisk(): Promise<void> {
        let modalDiv = document.getElementById("modal-disk");
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Change Disk Config
     */
    async applyDisk(): Promise<void> {
        let thisDiskList = this.getDisks();
        let newDiskList = []
        for(let i = 0; i < thisDiskList.length; i++) {
            let actualDisk = thisDiskList[i];
            if (actualDisk.diskBootOrder != null) {
                let thisDisk = {
                    "bootOrder": actualDisk.diskBootOrder,
                    "disk":{
                        "bus": actualDisk.diskBus
                    },
                    "name": actualDisk.diskName
                }
                newDiskList.push(thisDisk);
            } else {
                let thisDisk = {
                    "disk":{
                        "bus": actualDisk.diskBus
                    },
                    "name": actualDisk.diskName
                }
                newDiskList.push(thisDisk);
            }
        }
        try {
            const data = await lastValueFrom(this.kubeVirtService.patchVmDisks(this.activeVm.namespace, this.activeVm.name, JSON.stringify(newDiskList)));
            this.hideComponent("modal-disk");
            this.myToasts.toastSuccess(this.pageName, "", "Edited Virtual Machine : " + this.activeVm.name);
            this.reloadComponent();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, "", e.message);
            console.log(e);
        }
    }

    /*
     * Show Resize VM Window
     */
    showResize(sockets: number, cores: number, threads: number, memory: string): void {
        let modalDiv = document.getElementById("modal-resize");
        let resizeSocketsField = document.getElementById("resize-sockets");
        let resizeCoresField = document.getElementById("resize-cores");
        let resizeThreadsField = document.getElementById("resize-threads");
        let resizeMemoryField = document.getElementById("resize-memory");
        if(resizeSocketsField != null && resizeCoresField != null && resizeThreadsField != null && resizeMemoryField != null) {
            resizeSocketsField.setAttribute("placeholder", sockets.toString());
            resizeCoresField.setAttribute("placeholder", cores.toString());
            resizeThreadsField.setAttribute("placeholder", threads.toString());
            resizeMemoryField.setAttribute("placeholder", memory.toString());
            resizeSocketsField.setAttribute("value", sockets.toString());
            resizeCoresField.setAttribute("value", cores.toString());
            resizeThreadsField.setAttribute("value", threads.toString());
            resizeMemoryField.setAttribute("value", memory.replace("Gi", "").toString());
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
     * Resize Virtual Machine
     */
    async applyResize(sockets: string, cores: string, threads: string, memory: string): Promise<void> {
        if(sockets != "" && cores != "" && threads != "" && memory != "") {
            try {
                const data = await lastValueFrom(this.kubeVirtService.scaleVm(this.activeVm.namespace, this.activeVm.name, cores, threads, sockets, memory));
                this.hideComponent("modal-resize");
                this.myToasts.toastSuccess(this.pageName, "", "Edited Virtual Machine : " + this.activeVm.name);
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
        let selectorPcFiled = document.getElementById("changevm-pc");
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
     * Change VM Priority Class
     */
    async applyPc(pc: string): Promise<void> {
        try {
            const data = await lastValueFrom(this.kubeVirtService.changeVmPc(this.activeVm.namespace, this.activeVm.name, pc));
            this.hideComponent("modal-pc");
            this.myToasts.toastSuccess(this.pageName, "", "Edited Virtual Machine : " + this.activeVm.name);
            this.reloadComponent();
        } catch (e: any) {
            this.myToasts.toastError(this.pageName, "", e.message);
            console.log(e);
        }
    }

    /*
     * Open NoVNC
     */
    openNoVNC(): void {
        let url = "/assets/noVNC/vnc.html?resize=scale&autoconnect=1&path=";
        let path = "/k8s/apis/subresources.kubevirt.io/v1alpha3/namespaces/" + this.activeVm.namespace + "/virtualmachineinstances/" + this.activeVm.name + "/vnc";
        let fullpath = url + path;
        let newwindow = window.open(fullpath, "kubevirt-manager.io: CONSOLE", "width=800,height=600,location=no,toolbar=no,menubar=no,resizable=yes");
    }

    /*
     * Load Xterm
     */
    loadXterm(): void {
        let url = "/assets/xterm.html?";
        let params = "namespace=" + this.activeVm.namespace + "&vm="+ this.activeVm.name;
        let fullpath = url + params;
        this.urlSafeXterm = this.sanitizer.bypassSecurityTrustResourceUrl(fullpath);
    }

    /*
     * Load NoVNC
     */
    loadNoVNC(): void {
        let url = "/assets/noVNC/vnc.html?resize=scale&autoconnect=1&path=";
        let path = "/k8s/apis/subresources.kubevirt.io/v1alpha3/namespaces/" + this.activeVm.namespace + "/virtualmachineinstances/" + this.activeVm.name + "/vnc";
        let fullpath = url + path;
        this.urlSafeVnc = this.sanitizer.bypassSecurityTrustResourceUrl(fullpath);
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
        } else if (vmOperation == "pause") {
            const data = await lastValueFrom(this.kubeVirtService.pauseVm(vmNamespace, vmName));
            this.myToasts.toastSuccess(this.pageName, "", "Paused: " + vmName);
            this.reloadComponent();
        } else if (vmOperation == "unpause") {
            const data = await lastValueFrom(this.kubeVirtService.unpauseVm(vmNamespace, vmName));
            this.myToasts.toastSuccess(this.pageName, "", "Resumed: " + vmName);
            this.reloadComponent();
        } else if (vmOperation == "delete") {
            const data = await lastValueFrom(this.kubeVirtService.deleteVm(vmNamespace, vmName));
            this.myToasts.toastSuccess(this.pageName, "", "Deleted: " + vmName);
            this.reloadComponent();
        } else if (vmOperation == "migrate") {
            const data = await lastValueFrom(this.kubeVirtService.migrateVm(vmNamespace, vmName));
            this.myToasts.toastSuccess(this.pageName, "", "Migreated: " + vmName);
            this.reloadComponent();
        }
    }
    
    /*
     * Reload this component
     */
    reloadComponent(): void {
        this.router.navigateByUrl('/refresh',{skipLocationChange:true}).then(()=>{
            this.router.navigate([`/vmdetail/${this.vmNamespace}/${this.vmName}`]);
        })
    }

    /*
     * Reload Charts and Logs
     */
    async reloadChartsAndLogs(): Promise<void> {
        await this.reloadPrometheus();
        await this.loadSerialLog();
        await this.cdRef.detectChanges();
        
    }

}

