import { Component, OnInit } from '@angular/core';
import { K8sService } from 'src/app/services/k8s.service';
import { KubeVirtService } from 'src/app/services/kube-virt.service';

import { K8sNode } from 'src/app/models/k8s-node.model';
import { KubeVirtVM } from 'src/app/models/kube-virt-vm.model';
import { KubeVirtVMI } from 'src/app/models/kube-virt-vmi.model';
import { lastValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { VMImage } from 'src/app/models/vmimage.model';
import { VMDisk } from 'src/app/models/vmdisk.model';
import { WorkerService } from 'src/app/services/worker.service';
import { NetworkAttach } from 'src/app/models/network-attach.model';
import { K8sApisService } from 'src/app/services/k8s-apis.service';


@Component({
  selector: 'app-vmlist',
  templateUrl: './vmlist.component.html',
  styleUrls: ['./vmlist.component.css']
})
export class VmlistComponent implements OnInit {

  nodeList: K8sNode[] = [];
  vmList: KubeVirtVM[] = [];
  imageList: VMImage[] = [];
  diskList: VMDisk[] = [];
  namespaceList: string[] = [];
  networkList: NetworkAttach[] = [];
  netAttachList: NetworkAttach[] = []
  networkCheck: boolean = false;
  myVmTemplate = {
    'apiVersion': "kubevirt.io/v1",
    'kind': "VirtualMachine",
    'metadata':{
      'name': "",
      'namespace': ""
    },
    'spec': {
      'running' : false,
      'template':{
        'metadata': {
          'labels': {}
        },
        'spec': {
          'nodeSelector':{},
          'domain': {
            'cpu': {
              'sockets': 0,
              'threads': 0,
              'cores': 0
            },
            'devices': {
              'disks':[{}],
              'interfaces': [{}]
            },
            'resources':{
              'requests': {
                'memory': ""
              }
            }
          },
          'networks':[{}],
          'volumes':[{}]
        }
      }
    }
  };

  constructor(
    private k8sService: K8sService,
    private router: Router,
    private workerService: WorkerService,
    private k8sApisService: K8sApisService,
    private kubeVirtService: KubeVirtService
  ) { }

  async ngOnInit(): Promise<void> {
    await this.getVMs();
    await this.getNodes();
    await this.checkNetwork();
    let navTitle = document.getElementById("nav-title");
    if(navTitle != null) {
      navTitle.replaceChildren("Virtual Machines");
    }
  }

  /*
   * Load Nodes
   */
  async getNodes(): Promise<void> {
    let currentNode = new K8sNode;
    const data = await lastValueFrom(this.k8sService.getNodes());
    let nodes = data.items;
    for (let i = 0; i < nodes.length; i++) {
        currentNode = new K8sNode();
        currentNode.name = nodes[i].metadata["name"];
        currentNode.arch = nodes[i].status.nodeInfo["architecture"];
        currentNode.cidr = nodes[i].spec["podCIDR"];
        currentNode.mem = nodes[i].status.capacity["memory"];
        currentNode.disk = nodes[i].status.capacity["ephemeral-storage"];
        currentNode.cpu = nodes[i].status.capacity["cpu"];
        currentNode.os = nodes[i].status.nodeInfo["operatingSystem"];
        currentNode.osimg = nodes[i].status.nodeInfo["osImage"];
        currentNode.kernel = nodes[i].status.nodeInfo["kernelVersion"];
        currentNode.criver = nodes[i].status.nodeInfo["containerRuntimeVersion"];
        currentNode.kubever = nodes[i].status.nodeInfo["kubeletVersion"];
        for(let j = 0; j < this.vmList.length; j++) {
            if (this.vmList[j].nodeSel == currentNode.name)
              currentNode.vmlist.push(this.vmList[j]);
        }
        this.nodeList.push(currentNode);
    }
  }

  /*
   * Load VM List
   */
  async getVMs(): Promise<void> {
    let currentVm = new KubeVirtVM;
    const data = await lastValueFrom(this.kubeVirtService.getVMs());
    let vms = data.items;
    for (let i = 0; i < vms.length; i++) {
        currentVm = new KubeVirtVM();
        currentVm.name = vms[i].metadata["name"];
        currentVm.namespace = vms[i].metadata["namespace"];
        currentVm.running = vms[i].spec["running"];
        currentVm.status = vms[i].status["printableStatus"];
        currentVm.cores = vms[i].spec.template.spec.domain.cpu["cores"];
        currentVm.sockets = vms[i].spec.template.spec.domain.cpu["sockets"];
        currentVm.threads = vms[i].spec.template.spec.domain.cpu["threads"];
        currentVm.memory = vms[i].spec.template.spec.domain.resources.requests["memory"];
        currentVm.nodeSel = vms[i].spec.template.spec.nodeSelector["kubernetes.io/hostname"];
        if(currentVm.running) {
            let currentVmi = new KubeVirtVMI;
            try {
              const datavmi = await lastValueFrom(this.kubeVirtService.getVMi(currentVm.namespace, currentVm.name));
              currentVmi = new KubeVirtVMI();
              currentVmi.name = datavmi.metadata["name"];
              currentVmi.namespace = datavmi.metadata["namespace"];
              currentVmi.osId = datavmi.status.guestOSInfo["id"]
              currentVmi.osKernRel = datavmi.status.guestOSInfo["kernelRelease"]
              currentVmi.osKernVer = datavmi.status.guestOSInfo["kernelVersion"]
              currentVmi.osName = datavmi.status.guestOSInfo["name"]
              currentVmi.osPrettyName = datavmi.status.guestOSInfo["prettyName"];
              currentVmi.osVersion = datavmi.status.guestOSInfo["version"]
              try {
                currentVmi.ifAddr = datavmi.status.interfaces[0]["ipAddress"];
                currentVmi.ifName = datavmi.status.interfaces[0]["name"];
              } catch(e) {
                currentVmi.ifAddr = "";
                currentVmi.ifName = "";
              }
              currentVmi.nodeName = datavmi.status["nodeName"];
              currentVm.vmi = currentVmi;
            } catch (e) {
              console.log("ERROR Retrieving VMI: " + currentVm.name + "-" + currentVm.namespace + ":" + currentVm.status);
            }
        }
        this.vmList.push(currentVm);
    }
  }

  /*
   * Show New VM Window
   */
  async showNewVm(nodeName: string): Promise<void> {
    let i = 0;
    let modalDiv = document.getElementById("modal-newvm");
    let modalTitle = document.getElementById("newvm-title");
    let modalBody = document.getElementById("newvm-value");

    let selectorNamespacesField = document.getElementById("newvm-namespace");
    let inputNewvmNode = document.getElementById("newvm-node");

    /* Set Node for VM */
    if(inputNewvmNode != null) {
      inputNewvmNode.setAttribute("value", nodeName);
    }

    /* Load Namespace List and Set Selector */
    let data = await lastValueFrom(this.k8sService.getNamespaces());
    let nsSelectorOptions = "";
    for (i = 0; i < data.items.length; i++) {
      this.namespaceList.push(data.items[i].metadata["name"]);
      nsSelectorOptions += "<option value=" + data.items[i].metadata["name"] +">" + data.items[i].metadata["name"] + "</option>\n";
    }
    if (selectorNamespacesField != null) {
      selectorNamespacesField.innerHTML = nsSelectorOptions;
    }

    if(modalTitle != null) {
      modalTitle.replaceChildren("New Virtual Machine: " + nodeName);
    }

    /* Clean up devices */
    while(this.myVmTemplate.spec.template.spec.domain.devices.disks.length > 0) {
      this.myVmTemplate.spec.template.spec.domain.devices.disks.pop();
    }
    while(this.myVmTemplate.spec.template.spec.volumes.length > 0){
      this.myVmTemplate.spec.template.spec.volumes.pop();
    }

    /* Clean up networks */
    while(this.myVmTemplate.spec.template.spec.networks.length > 0){
      this.myVmTemplate.spec.template.spec.networks.pop();
    }
    while(this.myVmTemplate.spec.template.spec.domain.devices.interfaces.length > 0) {
      this.myVmTemplate.spec.template.spec.domain.devices.interfaces.pop();
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
   * Hide New VM Windows
   */
  hideNewVm(): void {
    let modalDiv = document.getElementById("modal-newvm");
    if(modalDiv != null) {
      modalDiv.setAttribute("class", "modal fade");
      modalDiv.setAttribute("aria-modal", "false");
      modalDiv.setAttribute("role", "");
      modalDiv.setAttribute("aria-hidden", "true");
      modalDiv.setAttribute("style","display: none;");
    }
  }

  /*
   * New VM: Create the New VM
   */
  async applyNewVm(
    newvmname: string,
    newvmnamespace: string,
    newvmnode: string,
    newvmcpumemsockets: string,
    newvmcpumemcores: string,
    newvmcpumemthreads: string,
    newvmcpumemmemory: string,
    newvmdiskonetype: string,
    newvmdiskonevalue: string,
    newvmdiskonesize: string,
    newvmdisktwotype: string,
    newvmdisktwovalue: string,
    newvmdisktwosize: string,
    newvmnetwork: string,
    newvmcloudinitusername: string,
    newvmcloudinitpassword: string,
    newvmcloudinitip: string,
    newvmcloudinitnetmask: string,
    newvmcloudinitgw: string,
    newvmcloudinitdns1: string,
    newvmcloudinitdns2: string
  ) {
    /* Basic Form Fields Check/Validation */
    if(newvmname == "" || newvmcpumemsockets == "" ||
       newvmcpumemcores == "" || newvmcpumemthreads == "" ||
       newvmcpumemmemory == "" || newvmnamespace == "") {
      alert("You need to fill in the basic fields (name, namespace, cpu, memory!");
    } else if (newvmdiskonetype == "none") {
      alert("Your virtual machine needs at least the first disk!");
    } else if ((newvmdiskonetype == "blank" || newvmdiskonetype == "image") && newvmdiskonesize == "") {
      alert("You need to set a size for your disk!");
    } else if (newvmdiskonetype == "image" && newvmdiskonevalue == "") {
      alert("You need to select a source image for your disk!");
    } else if (newvmdiskonetype == "disk" && newvmdiskonevalue == "") {
      alert("You need to select the disk!");
    } else if ((newvmdisktwotype == "blank" || newvmdisktwotype == "image") && newvmdisktwosize == "") {
      alert("You need to set a size for your disk!");
    } else if (newvmdisktwotype == "image" && newvmdisktwovalue == "") {
      alert("You need to select a source image for your disk!");
    } else if (newvmdisktwotype == "disk" && newvmdisktwovalue == "") {
      alert("You need to select the disk!");
    } else if(this.checkVmExists(newvmname, newvmnamespace)) {
      alert("VM with name/namespace combination already exists!");
    } else {
      /* Basic Setup */
      this.myVmTemplate.metadata.name = newvmname;
      this.myVmTemplate.metadata.namespace = newvmnamespace;
      this.myVmTemplate.spec.template.metadata.labels = {'kubevirt.io/domain': newvmname};
      this.myVmTemplate.spec.template.spec.nodeSelector = {'kubernetes.io/hostname': newvmnode};
      this.myVmTemplate.spec.template.spec.domain.cpu.cores = Number(newvmcpumemcores);
      this.myVmTemplate.spec.template.spec.domain.cpu.threads = Number(newvmcpumemthreads);
      this.myVmTemplate.spec.template.spec.domain.cpu.sockets = Number(newvmcpumemsockets);
      this.myVmTemplate.spec.template.spec.domain.resources.requests.memory = newvmcpumemmemory + "Gi";

      /* Clean up devices */
      while(this.myVmTemplate.spec.template.spec.domain.devices.disks.length > 0) {
        this.myVmTemplate.spec.template.spec.domain.devices.disks.pop();
      }
      while(this.myVmTemplate.spec.template.spec.volumes.length > 0){
        this.myVmTemplate.spec.template.spec.volumes.pop();
      }

      /* Clean up networks */
      while(this.myVmTemplate.spec.template.spec.networks.length > 0){
        this.myVmTemplate.spec.template.spec.networks.pop();
      }
      while(this.myVmTemplate.spec.template.spec.domain.devices.interfaces.length > 0) {
        this.myVmTemplate.spec.template.spec.domain.devices.interfaces.pop();
      }

      /* Placeholders */
      let data = "";
      let disk1 = {};
      let device1 = {};
      let disk2 = {};
      let device2 = {};
      let disk3 = {};
      let device3 = {};
      let net1 = {};
      let iface1 = {};
      let cloudconfig  = "#cloud-config\n";
          cloudconfig += "manage_etc_hosts: true\n";
          cloudconfig += "hostname: " + newvmname + "\n";
      let netconfig  ="version: 1\n";
          netconfig += "config:\n";
          netconfig += "    - type: physical\n";
          netconfig += "      name: enp1s0\n";
          netconfig += "      subnets:\n";

      /* Disk1 setup */
      if(newvmdiskonetype == "image") {
        /* Create Disk From Image */
        let disk1name = newvmnamespace + "-"+ newvmname + "-disk1.img";
        let disk1data = await lastValueFrom(await this.workerService.createDiskFromImage(newvmnode, disk1name, newvmdiskonevalue, newvmdiskonesize));
        let disk1path = disk1data.message;
        disk1 = { 'name': "disk1", 'disk': {}};
        device1 = { 'name': "disk1", 'hostDisk': { 'path': disk1path, 'type': "Disk"}}
        this.myVmTemplate.spec.template.spec.domain.devices.disks.push(disk1);
        this.myVmTemplate.spec.template.spec.volumes.push(device1);
      } else if (newvmdiskonetype == "blank") {
        /* Create Blank Disk */
        let disk1name = newvmnamespace + "-"+ newvmname + "-disk1.img";
        let disk1data = await lastValueFrom(await this.workerService.newBlankDisk(newvmnode, disk1name, newvmdiskonesize));
        let disk1path = disk1data.message;
        disk1 = { 'name': "disk1", 'disk': {}};
        device1 = { 'name': "disk1", 'hostDisk': { 'path': disk1path, 'type': "Disk"}}
        this.myVmTemplate.spec.template.spec.domain.devices.disks.push(disk1);
        this.myVmTemplate.spec.template.spec.volumes.push(device1);
      } else if (newvmdiskonetype == "disk") {
        /* Use Existing Disk */
        let dsk1path = newvmdiskonevalue;
        disk1 = { 'name': "disk1", 'disk': {}};
        device1 = { 'name': "disk1", 'hostDisk': { 'path': dsk1path, 'type': "Disk"}}
        this.myVmTemplate.spec.template.spec.domain.devices.disks.push(disk1);
        this.myVmTemplate.spec.template.spec.volumes.push(device1);
      }

      /* Disk2 setup */
      if(newvmdisktwotype == "image") {
        /* Create Disk From Image */
        let disk2name = newvmnamespace + "-"+ newvmname + "-disk2.img";
        let disk2data = await lastValueFrom(await this.workerService.createDiskFromImage(newvmnode, disk2name, newvmdisktwovalue, newvmdisktwosize));
        let disk2path = disk2data.message;
        disk2 = { 'name': "disk2", 'disk': {}};
        device2 = { 'name': "disk2", 'hostDisk': { 'path': disk2path, 'type': "Disk"}}
        this.myVmTemplate.spec.template.spec.domain.devices.disks.push(disk2);
        this.myVmTemplate.spec.template.spec.volumes.push(device2);
      } else if (newvmdisktwotype == "blank") {
        /* Create Blank Disk */
        let disk2name = newvmnamespace + "-"+ newvmname + "-disk2.img";
        let disk2data = await lastValueFrom(await this.workerService.newBlankDisk(newvmnode, disk2name, newvmdisktwosize));
        let disk2path = disk2data.message;
        disk2 = { 'name': "disk2", 'disk': {}};
        device2 = { 'name': "disk2", 'hostDisk': { 'path': disk2path, 'type': "Disk"}}
        this.myVmTemplate.spec.template.spec.domain.devices.disks.push(disk2);
        this.myVmTemplate.spec.template.spec.volumes.push(device2);
      } else if (newvmdisktwotype == "disk") {
        /* Use Existing Disk */
        let dsk2path = newvmdiskonevalue;
        disk2 = { 'name': "disk2", 'disk': {}};
        device2 = { 'name': "disk2", 'hostDisk': { 'path': dsk2path, 'type': "Disk"}}
        this.myVmTemplate.spec.template.spec.domain.devices.disks.push(disk2);
        this.myVmTemplate.spec.template.spec.volumes.push(device2);
      }

      /* UserData Setup */
      if(newvmcloudinitusername != "") {
        cloudconfig += "user: " + newvmcloudinitusername + "\n";
      }
      if (newvmcloudinitpassword != "") {
        cloudconfig += "password: " + newvmcloudinitpassword + "\n";
      }

      /* NetworkData Setup */
      if(newvmcloudinitip != "") {
        netconfig += "      - type: static\n";
        netconfig += "        address: \'" + newvmcloudinitip + "\'\n";
        netconfig += "        netmask: \'" + newvmcloudinitnetmask + "\'\n";
        netconfig += "        gateway: \'" + newvmcloudinitgw + "\'\n";
      } else {
        netconfig += "      - type: dhcp\n";
      }

      /* NetworkData Setup: DNS */
      if(newvmcloudinitdns1 != "") {
        netconfig += "    - type: nameserver\n";
        netconfig += "      address:\n";
        netconfig += "      - \'" + newvmcloudinitdns1 + "\'\n";
        if (newvmcloudinitdns2 != "") {
          netconfig += "      - \'" + newvmcloudinitdns2 + "\'\n";
        }
      } else {
        netconfig += "    - type: nameserver\n";
        netconfig += "      address:\n";
        netconfig += "      - \'8.8.8.8\'\n";
        netconfig += "      - \'8.8.4.4\'\n";
      }

      /* Adding UserData/NetworkData device */
      disk3 = {'name': "disk3", 'disk': {'bus': "virtio"}};
      device3 = {'name': "disk3", 'cloudInitNoCloud': {'userData': cloudconfig, 'networkData': netconfig}};
      this.myVmTemplate.spec.template.spec.domain.devices.disks.push(disk3);
      this.myVmTemplate.spec.template.spec.volumes.push(device3);

      /* Networking Setup */
      if(newvmnetwork != "") {
        net1 = {'name': "br0", 'multus': {'networkName': newvmnetwork}};
        iface1 = { 'name': "br0", 'bridge': {}};
        this.myVmTemplate.spec.template.spec.networks.push(net1);
        this.myVmTemplate.spec.template.spec.domain.devices.interfaces.push(iface1);
      } else {
        net1 = {'name': "default", 'pod': {}};
        iface1 = {'name': "default",'marquerade': {}};
        this.myVmTemplate.spec.template.spec.networks.push(net1);
        this.myVmTemplate.spec.template.spec.domain.devices.interfaces.push(iface1);
      }

      /* Create the VM */
      try {
        data = await lastValueFrom(this.kubeVirtService.createVm(newvmnamespace,newvmname, this.myVmTemplate));
        this.hideNewVm();
        this.reloadComponent();
      } catch (e) {
        console.log(e);
      }
    }

  }

  /*
   * Show Resize Window
   */
  showResize(vmName: string, vmNamespace: string, vmSockets: number, vmCores: number, vmThreads: number, vmMemory: string): void {
    let modalDiv = document.getElementById("modal-resize");
    let modalTitle = document.getElementById("resize-title");
    let modalBody = document.getElementById("resize-value");
    if(modalTitle != null) {
      modalTitle.replaceChildren("Resize: " + vmName);
    }
    if(modalBody != null) {
      let resizeNameField = document.getElementById("resize-name");
      let resizeNamespaceField = document.getElementById("resize-namespace");
      let resizeSocketsField = document.getElementById("resize-sockets");
      let resizeCoresField = document.getElementById("resize-cores");
      let resizeThreadsField = document.getElementById("resize-threads");
      let resizeMemoryField = document.getElementById("resize-memory");
      if(resizeNameField != null && resizeNamespaceField != null && resizeSocketsField != null && resizeCoresField != null && resizeThreadsField != null && resizeMemoryField != null) {
        resizeNameField.setAttribute("value", vmName);
        resizeNamespaceField.setAttribute("value", vmNamespace);
        resizeSocketsField.setAttribute("placeholder", vmSockets.toString());
        resizeCoresField.setAttribute("placeholder", vmCores.toString());
        resizeThreadsField.setAttribute("placeholder", vmThreads.toString());
        resizeMemoryField.setAttribute("placeholder", vmMemory.toString());
        resizeSocketsField.setAttribute("value", vmSockets.toString());
        resizeCoresField.setAttribute("value", vmCores.toString());
        resizeThreadsField.setAttribute("value", vmThreads.toString());
        resizeMemoryField.setAttribute("value", vmMemory.replace("Gi", "").toString());
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
   * Hide Resize Windows
   */
  hideResize(): void {
    let modalDiv = document.getElementById("modal-resize");
    if(modalDiv != null) {
      modalDiv.setAttribute("class", "modal fade");
      modalDiv.setAttribute("aria-modal", "false");
      modalDiv.setAttribute("role", "");
      modalDiv.setAttribute("aria-hidden", "true");
      modalDiv.setAttribute("style","display: none;");
    }
  }

  /*
   * Resize Virtual Machine
   */
  async applyResize(sockets: string, cores: string, threads: string, memory: string): Promise<void> {
    let resizeNameField = document.getElementById("resize-name");
    let resizeNamespaceField = document.getElementById("resize-namespace");
    if(sockets != "" && cores != "" && threads != "" && memory != "" && resizeNameField != null && resizeNamespaceField != null) {
      let resizeName = resizeNameField.getAttribute("value");
      let resizeNamespace = resizeNamespaceField.getAttribute("value");
      if(resizeName != null && resizeNamespace != null) {
        try {
          const data = await lastValueFrom(this.kubeVirtService.scaleVm(resizeNamespace, resizeName, cores, threads, sockets, memory));
          this.hideResize();
          this.reloadComponent();
        } catch (e) {
          console.log(e);
        }
      }
    }
  }

  /*
   * Show Delete Window
   */
  showDelete(vmName: string, vmNamespace: string): void {
    let modalDiv = document.getElementById("modal-delete");
    let modalTitle = document.getElementById("delete-title");
    let modalBody = document.getElementById("delete-value");
    if(modalTitle != null) {
      modalTitle.replaceChildren("Delete!");
    }
    if(modalBody != null) {
      let vmNameInput = document.getElementById("delete-name");
      let vmNamespaceInput = document.getElementById("delete-namespace");
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
   * Hide Delete Window
   */
  hideDelete(): void {
    let modalDiv = document.getElementById("modal-delete");
    if(modalDiv != null) {
      modalDiv.setAttribute("class", "modal fade");
      modalDiv.setAttribute("aria-modal", "false");
      modalDiv.setAttribute("role", "");
      modalDiv.setAttribute("aria-hidden", "true");
      modalDiv.setAttribute("style","display: none;");
    }
  }

  /*
   * Delete Virtual Machine
   */
  async applyDelete(): Promise<void> {
    let vmNameInput = document.getElementById("delete-name");
    let vmNamespaceInput = document.getElementById("delete-namespace");
    if(vmNameInput != null && vmNamespaceInput != null) {
      let vmName = vmNameInput.getAttribute("value");
      let vmNamespace = vmNamespaceInput.getAttribute("value");
      if(vmName != null && vmNamespace != null) {
        try {
          const data = await lastValueFrom(this.kubeVirtService.deleteVm(vmNamespace, vmName));
          this.hideDelete();
          this.reloadComponent();
        } catch (e) {
          console.log(e);
        }
      }
    }
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
      var data = await lastValueFrom(this.kubeVirtService.startVm(vmNamespace, vmName));
      data = await lastValueFrom(this.kubeVirtService.startVm(vmNamespace, vmName));
      this.reloadComponent();
    } else if (vmOperation == "pause") {
      const data = await lastValueFrom(this.kubeVirtService.pauseVm(vmNamespace, vmName));
      this.reloadComponent();
    } else if (vmOperation == "unpause") {
      const data = await lastValueFrom(this.kubeVirtService.unpauseVm(vmNamespace, vmName));
      this.reloadComponent();
    } else if (vmOperation == "delete") {
      const data = await lastValueFrom(this.kubeVirtService.deleteVm(vmNamespace, vmName));
      this.reloadComponent();
    }
  }

  /*
   * New VM: Control Disk1 Options
   */
  async onChangeDiskOne(diskType: string, nodeName: string) {
    let diskOneValueField = document.getElementById("newvm-diskonevalue");
    let diskOneSizeField = document.getElementById("newvm-diskonesize");
    if(diskType == "none") {
      if (diskOneValueField != null && diskOneSizeField != null) {
        diskOneValueField.setAttribute("disabled", "disabled");
        diskOneSizeField.setAttribute("disabled", "disabled");
      }
    } else if (diskType == "blank") {
      if (diskOneValueField != null && diskOneSizeField != null) {
        diskOneValueField.setAttribute("disabled", "disabled");
        diskOneSizeField.removeAttribute("disabled");
      }
    } else if (diskType == "image") {
      if (diskOneValueField != null && diskOneSizeField != null) {
        diskOneValueField.innerHTML = await this.loadImageOptions(nodeName);
        diskOneValueField.removeAttribute("disabled");
        diskOneSizeField.removeAttribute("disabled");
      }

    } else if (diskType == "disk") {
      if (diskOneValueField != null && diskOneSizeField != null) {
        diskOneValueField.innerHTML = await this.loadDiskOptions(nodeName);
        diskOneValueField.removeAttribute("disabled");
        diskOneSizeField.setAttribute("disabled", "disabled");
      }

    }
  }

  /*
   * New VM: Control Disk2 Options
   */
  async onChangeDiskTwo(diskType: string, nodeName: string) {
    let diskTwoValueField = document.getElementById("newvm-disktwovalue");
    let diskTwoSizeField = document.getElementById("newvm-disktwosize");
    if(diskType == "none") {
      if (diskTwoValueField != null && diskTwoSizeField != null) {
        diskTwoValueField.setAttribute("disabled", "disabled");
        diskTwoSizeField.setAttribute("disabled", "disabled");
      }
    } else if (diskType == "blank") {
      if (diskTwoValueField != null && diskTwoSizeField != null) {
        diskTwoValueField.setAttribute("disabled", "disabled");
        diskTwoSizeField.removeAttribute("disabled");
      }
    } else if (diskType == "image") {
      if (diskTwoValueField != null && diskTwoSizeField != null) {
        diskTwoValueField.innerHTML = await this.loadImageOptions(nodeName);
        diskTwoValueField.removeAttribute("disabled");
        diskTwoSizeField.removeAttribute("disabled");
      }

    } else if (diskType == "disk") {
      if (diskTwoValueField != null && diskTwoSizeField != null) {
        diskTwoValueField.innerHTML = await this.loadDiskOptions(nodeName);
        diskTwoValueField.removeAttribute("disabled");
        diskTwoSizeField.setAttribute("disabled", "disabled");
      }

    }
  }

  /*
   * New VM: Load Image Options
   */
  async loadImageOptions(nodeName: string){
    let data = await lastValueFrom(await this.workerService.getImages(nodeName));
    let imageSelectorOptions = "";
    let images = data;
    for (let i = 0; i < images.length; i++) {
      let currentImg = new VMImage();
      currentImg.name = images[i]["name"];
      currentImg.size = images[i]["size"];
      currentImg.path = images[i]["path"]
      currentImg.node = this.nodeList[i].name;
      this.imageList.push(currentImg);
      imageSelectorOptions += "<option value=" + images[i]["name"] +">" + images[i]["name"] + "</option>\n";
    }
    return imageSelectorOptions;
  }

  /*
   * New VM: Load Disk Options
   */
  async loadDiskOptions(nodeName: string) {
    let data = await lastValueFrom(await this.workerService.getDisks(nodeName));
    let diskSelectorOptions = "";
    let disks = data;
    for (let i = 0; i < disks.length; i++) {
      let currentDsk = new VMDisk();
      currentDsk.name = disks[i]["name"];
      currentDsk.size = disks[i]["size"];
      currentDsk.path = disks[i]["path"];
      currentDsk.node = this.nodeList[i].name;
      this.diskList.push(currentDsk);
      diskSelectorOptions += "<option value=" + disks[i]["path"] +">" + disks[i]["name"] + "</option>\n";
    }
    return diskSelectorOptions;
  }

  /*
   * New VM: Load Network Options
   */
  async onChangeNamespace(namespace: string) {
    let selectorNetworkField = document.getElementById("newvm-network");
    if(this.networkCheck) {
      let data = await lastValueFrom(this.k8sApisService.getNetworkAttachs());
      let networkSelectorOptions = "";
      let netAttach = data.items;
      for (let i = 0; i < netAttach.length; i++) {
        if(namespace == netAttach[i].metadata["namespace"]) {
          let currentAttach = new NetworkAttach();
          currentAttach.name = netAttach[i].metadata["name"];
          currentAttach.namespace = netAttach[i].metadata["namespace"];
          currentAttach.config = JSON.parse(netAttach[i].spec["config"]);
          this.netAttachList.push(currentAttach);
          networkSelectorOptions += "<option value=" + netAttach[i].metadata["name"] + ">" + netAttach[i].metadata["name"] + "</option>\n";
        }
      }
      if (selectorNetworkField != null && networkSelectorOptions != "") {
        selectorNetworkField.innerHTML = networkSelectorOptions;
        selectorNetworkField.removeAttribute("disabled");
      }
    }
  }

  /*
   * Check VM Exists
   */
  checkVmExists(vmname: string, vmnamespace:string): boolean {
    for (let i = 0; i < this.vmList.length; i++) {
      if(this.vmList[i].name == vmname && this.vmList[i].namespace == vmnamespace) {
        return true;
      }
    }
    return false;
  }

  /*
   * Check Multus Support
   */
  async checkNetwork(): Promise<void> {
    const data = await lastValueFrom(this.k8sApisService.getCrds());
    let crds = data.items;
    for (let i = 0; i < crds.length; i++) {
      if(crds[i].metadata["name"] == "network-attachment-definitions.k8s.cni.cncf.io") {
        this.networkCheck = true;
      }
    }
  }

  /*
   * Reload this component
   */
  reloadComponent(): void {
    this.router.navigateByUrl('/',{skipLocationChange:true}).then(()=>{
      this.router.navigate([`/vmlist`]);
    })
  }

}