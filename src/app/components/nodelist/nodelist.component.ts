import { Component, OnInit } from '@angular/core';
import { K8sService } from 'src/app/services/k8s.service';
import { K8sNode } from 'src/app/models/k8s-node.model';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-nodelist',
  templateUrl: './nodelist.component.html',
  styleUrls: ['./nodelist.component.css']
})
export class NodelistComponent implements OnInit {

    pageName: string = "Nodes";

    nodeList: K8sNode[] = []

    constructor(
        private k8sService: K8sService
    ) { }

    async ngOnInit(): Promise<void> {
        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren(this.pageName);
        }
        await this.getNodes();
    }

    /*
     * Get Nodes from Kubernetes
     */
    async getNodes(): Promise<void> {
        try {
            let currentNode = new K8sNode;
            const data = await lastValueFrom(this.k8sService.getNodes());
            let nodes = data.items;
            for (let i = 0; i < nodes.length; i++) {
                currentNode = new K8sNode();
                currentNode.name = nodes[i].metadata["name"];
                currentNode.arch = nodes[i].status.nodeInfo["architecture"];
                currentNode.cidr = nodes[i].spec["podCIDR"];
                currentNode.mem = this.convertSize(nodes[i].status.capacity["memory"]);
                currentNode.disk = this.convertSize(nodes[i].status.capacity["ephemeral-storage"]);
                currentNode.cpu = nodes[i].status.capacity["cpu"];
                currentNode.os = nodes[i].status.nodeInfo["operatingSystem"];
                currentNode.osimg = nodes[i].status.nodeInfo["osImage"];
                currentNode.kernel = nodes[i].status.nodeInfo["kernelVersion"];
                currentNode.criver = nodes[i].status.nodeInfo["containerRuntimeVersion"];
                currentNode.kubever = nodes[i].status.nodeInfo["kubeletVersion"];
                this.nodeList.push(currentNode);
            }
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Convert unit size
     */
    convertSize(inputSize: string): string {
        inputSize = inputSize.replace('Ki','');
        var fileSize = Number.parseFloat(inputSize)  / (1024*1024);
        return (Math.round(fileSize * 100) / 100).toString() + " GB";
    }

}
