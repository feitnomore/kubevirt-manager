import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VirtualMachineClusterInstanceType } from '../interfaces/virtual-machine-cluster-instance-type';
import { VirtualMachine } from '../interfaces/virtual-machine';
import { VirtualMachinePool } from '../interfaces/virtual-machine-pool';
import { addVolumeOptions } from '../interfaces/addVolumeOptions';
import { removeVolumeOptions } from '../interfaces/removeVolumeOptions';


@Injectable({
  providedIn: 'root'
})
export class KubeVirtService {

    constructor(private http: HttpClient) { }

    getKubevirts(): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        return this.http.get(`${baseUrl}/kubevirts`);
    }

    getKubevirt(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        return this.http.get(`${baseUrl}/namespaces/${namespace}/kubevirts/${name}`);
    }

    getVMs(): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        return this.http.get(`${baseUrl}/virtualmachines`);
    }

    getVM(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        return this.http.get(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}?labelSelector=kubevirt-manager.io%2Fmanaged`);
    }

    getVMsNamespaced(namespace: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        return this.http.get(`${baseUrl}/namespaces/${namespace}/virtualmachines?labelSelector=kubevirt-manager.io%2Fmanaged`);
    }

    getPooledVM(namespace: string, pool: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        return this.http.get(`${baseUrl}/namespaces/${namespace}/virtualmachines?labelSelector=kubevirt.io%2Fvmpool%3D${pool}&labelSelector=kubevirt-manager.io%2Fmanaged`);
    }

    getVMis(): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        return this.http.get(`${baseUrl}/virtualmachineinstances`);
    }

    getVMi(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        return this.http.get(`${baseUrl}/namespaces/${namespace}/virtualmachineinstances/${name}`);
    }

    getPooledVMI(namespace: string, pool: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        return this.http.get(`${baseUrl}/namespaces/${namespace}/virtualmachineinstances?labelSelector=kubevirt.io%2Fvmpool%3D${pool}&labelSelector=kubevirt-manager.io%2Fmanaged`);
    }

    getVMPools(): Observable<any> {
        var baseUrl ='./k8s/apis/pool.kubevirt.io/v1alpha1';
        return this.http.get(`${baseUrl}/virtualmachinepools?labelSelector=kubevirt.io%2Fvmpool&labelSelector=kubevirt-manager.io%2Fmanaged`);
    }

    getVMPoolsNamespaced(namespace: string): Observable<any> {
        var baseUrl ='./k8s/apis/pool.kubevirt.io/v1alpha1';
        return this.http.get(`${baseUrl}/namespaces/${namespace}/virtualmachinepools?labelSelector=kubevirt-manager.io%2Fmanaged`);
    }

    getVMPool(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/pool.kubevirt.io/v1alpha1';
        return this.http.get(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`);
    }

    startVmOld(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}`, '{"spec":{"running": true}}', { 'headers': headers } );
    }

    startVm(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/subresources.kubevirt.io/v1';
        const headers = {
            'accept': 'application/json'
        };
        return this.http.put(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}/start`, { 'headers': headers } );
    }

    powerOnVm(namespace: string, name: string): Observable<any> {
        return this.startVm(namespace, name);
    }

    stopVmOld(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}`, '{"spec":{"running": false}}', { 'headers': headers } );
    }

    stopVm(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/subresources.kubevirt.io/v1';
        const headers = {
            'accept': 'application/json'
        };
        return this.http.put(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}/stop`, { 'headers': headers } );
    }

    powerOffVm(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        const headers = {
            'content-type': 'application/json',
            'accept': 'application/json'
        };
        let body = '{"gracePeriodSeconds":0,"propagationPolicy":"Background"}';
        return this.http.delete(`${baseUrl}/namespaces/${namespace}/virtualmachineinstances/${name}`,  {'headers': headers, 'body': body});
    }

    restartVm(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/subresources.kubevirt.io/v1';
        const headers = {
            'accept': 'application/json'
        };
        return this.http.put(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}/restart`, { 'headers': headers } );
    }

    pauseVm(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/subresources.kubevirt.io/v1';
        const headers = {
            'accept': 'application/json'
        };
        return this.http.put(`${baseUrl}/namespaces/${namespace}/virtualmachineinstances/${name}/pause`, { 'headers': headers } );
    }

    unpauseVm(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/subresources.kubevirt.io/v1';
        const headers = {
            'accept': 'application/json'
        };
        return this.http.put(`${baseUrl}/namespaces/${namespace}/virtualmachineinstances/${name}/unpause`, { 'headers': headers } );
    }

    scaleVm(namespace: string, name: string, cores: string, threads: string, sockets: string, memory: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}`, '{"spec":{"template":{"spec":{"domain":{"cpu":{"sockets": '+sockets+',"cores": '+cores+',"threads": '+threads+'},"resources":{"requests":{"memory": "'+memory+'Gi"}}}}}}}', { 'headers': headers } );
    }

    changeVmStrategy(namespace: string, name: string, strategy: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}`, '{"spec":{"runStrategy":"' + strategy + '"}}', { 'headers': headers } );
    }

    changeVmType(namespace: string, name: string, type: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}`, '{"spec":{"instancetype":{"name":"'+type+'"}}}', { 'headers': headers } );
    }

    changeVmPc(namespace: string, name: string, pc: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}`, '{"spec":{"template":{"spce":{"priorityClassname":"'+pc+'"}}}}', { 'headers': headers } );
    }

    patchVmDisks(namespace: string, name: string, disks: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}`, '{"spec":{"template":{"spec":{"domain":{"devices":{"disks":' + disks + '}}}}}}', { 'headers': headers } );
    }

    deleteVm(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        return this.http.delete(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}`);
    }

    migrateVm(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        const headers = {
            'content-type': 'application/json',
            'accept': 'application/json'
        };
        return this.http.post(`${baseUrl}/namespaces/${namespace}/virtualmachineinstancemigrations/`, {
            "apiVersion": "kubevirt.io/v1",
            "kind": "VirtualMachineInstanceMigration",
            "metadata": {
                "name": `${name}-lm-${Date.now()}`,
                "namespace": namespace
            },
            "spec": {
                "vmiName": name
            }
        }, { 'headers': headers } );
    }
    
    createVm(virtualMachine: VirtualMachine): Observable<any> {
        var baseUrl ='./k8s/apis/' + virtualMachine.apiVersion;
        let name = virtualMachine.metadata.name;
        let namespace = virtualMachine.metadata.namespace;
        const headers = {
            'content-type': 'application/json',
            'accept': 'application/json'
        };
        return this.http.post(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}`, virtualMachine, { 'headers': headers } );
    }

    getClusterInstanceTypes(): Observable<any> {
        var baseUrl ='./k8s/apis/instancetype.kubevirt.io/v1beta1';
        return this.http.get(`${baseUrl}/virtualmachineclusterinstancetypes`);
    }

    getClusterInstanceType(instType: string): Observable<any> {
        var baseUrl ='./k8s/apis/instancetype.kubevirt.io/v1beta1';
        return this.http.get(`${baseUrl}/virtualmachineclusterinstancetypes/${instType}`);
    }

    deleteClusterInstanceType(typeName: string): Observable<any> {
        var baseUrl ='./k8s/apis/instancetype.kubevirt.io/v1beta1';
        return this.http.delete(`${baseUrl}/virtualmachineclusterinstancetypes/${typeName}`);
    }

    createClusterInstanceType(clusterInstanceType: VirtualMachineClusterInstanceType): Observable<any> {
        var baseUrl ='./k8s/apis/' + clusterInstanceType.apiVersion;
        var name = clusterInstanceType.metadata.name;
        const headers = {
            'content-type': 'application/json',
            'accept': 'application/json'
        };
        return this.http.post(`${baseUrl}/virtualmachineclusterinstancetypes/${name}`, clusterInstanceType, { 'headers': headers } );
    }

    editClusterInstanceType(typeName: string, typeCPU: string, typeMemory: string): Observable<any> {
        var baseUrl ='./k8s/apis/instancetype.kubevirt.io/v1beta1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/virtualmachineclusterinstancetypes/${typeName}`, '{"spec":{"cpu":{"guest":' + typeCPU + '},"memory":{"guest":"' + typeMemory + 'Gi"}}}', { 'headers': headers } );
    }

    startPool(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/pool.kubevirt.io/v1alpha1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`, '{"spec":{"virtualMachineTemplate":{"spec":{"runStrategy": "Always"}}}}', { 'headers': headers } );
    }

    stopPool(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/pool.kubevirt.io/v1alpha1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`, '{"spec":{"virtualMachineTemplate":{"spec":{"runStrategy": "Halted"}}}}', { 'headers': headers } );
    }

    deletePool(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/pool.kubevirt.io/v1alpha1';
        return this.http.delete(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`);
    }

    scalePoolReplicas(namespace: string, name: string, size: string): Observable<any> {
        var baseUrl ='./k8s/apis/pool.kubevirt.io/v1alpha1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`, '{"spec":{"replicas": ' + size + '}}', { 'headers': headers } );
    }

    scalePool(namespace: string, name: string, cores: string, threads: string, sockets: string, memory: string): Observable<any> {
        var baseUrl ='./k8s/apis/pool.kubevirt.io/v1alpha1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`, '{"spec":{"virtualMachineTemplate":{"spec":{"template":{"spec":{"domain":{"cpu":{"sockets": '+sockets+',"cores": '+cores+',"threads": '+threads+'},"resources":{"requests":{"memory": "'+memory+'Gi"}}}}}}}}}', { 'headers': headers } );
    }

    createPool(virtualMachinePool: VirtualMachinePool): Observable<any> {
        var baseUrl ='./k8s/apis/' + virtualMachinePool.apiVersion;
        var name = virtualMachinePool.metadata.name;
        var namespace = virtualMachinePool.metadata.namespace;
        const headers = {
            'content-type': 'application/json',
            'accept': 'application/json'
        };
        return this.http.post(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`, virtualMachinePool, { 'headers': headers } );
    }

    changePoolType(namespace: string, name: string, type: string): Observable<any> {
        var baseUrl ='./k8s/apis/pool.kubevirt.io/v1alpha1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`, '{"spec":{"virtualMachineTemplate":{"spec":{"instancetype":{"name":"'+type+'"}}}}}', { 'headers': headers } );
    }

    changePoolStrategy(namespace: string, name: string, strategy: string): Observable<any> {
        var baseUrl ='./k8s/apis/pool.kubevirt.io/v1alpha1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`, '{"spec":{"virtualMachineTemplate":{"spec":{"runStrategy":"' + strategy + '"}}}}', { 'headers': headers } );
    }

    changePoolPc(namespace: string, name: string, pc: string): Observable<any> {
        var baseUrl ='./k8s/apis/pool.kubevirt.io/v1alpha1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`, '{"spec":{"virtualMachineTemplate":{"spec":{"template":{"spec":{"priorityClassName":"' + pc + '"}}}}}}', { 'headers': headers } );
    }

    removeVmFromPool(namespace: string, name: string, node: string): Observable<any> {
        var baseUrl ='./k8s/apis/kubevirt.io/v1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachines/${name}`, '{"metadata":{"labels":{"kubevirt.io/domain":"'+ name +'","kubevirt.io/vm-pool-revision-name":null,"kubevirt.io/vmpool":null},"ownerReferences":null},"spec":{"template":{"spec": {"nodeSelector":{"kubernetes.io/hostname": "'+ node +'"}},"metadata":{"labels":{"kubevirt.io/domain":"'+ name +'","kubevirt.io/vm-pool-revision-name":null,"kubevirt.io/vmpool":null}}}}}', { 'headers': headers } );
    }

    removePoolLiveness(namespace: string, name: string): Observable<any> {
        var baseUrl ='./k8s/apis/pool.kubevirt.io/v1alpha1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`, '{"spec":{"virtualMachineTemplate":{"spec":{"template":{"spec":{"livenessProbe":null}}}}}}', { 'headers': headers } );
    }

    updatePoolLiveness(namespace: string, name: string, liveness: string): Observable<any> {
        var baseUrl ='./k8s/apis/pool.kubevirt.io/v1alpha1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`, '{"spec":{"virtualMachineTemplate":{"spec":{"template":{"spec":{"livenessProbe":'+ liveness +'}}}}}}', { 'headers': headers } );
    }

    removePoolReadiness(namespace: string, name: string): Observable<any> {
        var baseUrl = './k8s/apis/pool.kubevirt.io/v1alpha1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`, '{"spec":{"virtualMachineTemplate":{"spec":{"template":{"spec":{"readinessProbe":null}}}}}}', { 'headers': headers } );
    }

    updatePoolReadiness(namespace: string, name: string, readiness: string): Observable<any> {
        var baseUrl = './k8s/apis/pool.kubevirt.io/v1alpha1';
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/namespaces/${namespace}/virtualmachinepools/${name}`, '{"spec":{"virtualMachineTemplate":{"spec":{"template":{"spec":{"readinessProbe":'+ readiness +'}}}}}}', { 'headers': headers } );
    }

    findVMPod(namespace: string, uid: string): Observable<any> {
        var myUrl = "./k8s/api/v1/namespaces/" + namespace + "/pods?labelSelector=kubevirt.io%2Fcreated-by%3D" + uid + "&limit=1";

        return this.http.get(`${myUrl}`);
    }

    getVMSerialLog(namespace: string, name: string): Observable<any> {
        var myUrl = "./k8s/api/v1/namespaces/" + namespace + "/pods/" + name + "/log?container=guest-console-log";

        const headers = {
            'accept': 'application/json, */*'
        };

        return this.http.get(`${myUrl}`, {'headers': headers, 'responseType': "text"});
    }

    plugVolume(namespace: string, name: string, spec: addVolumeOptions): Observable<any> {
        var baseUrl ='./k8s/apis/subresources.kubevirt.io/v1';
        const headers = {
            'accept': '*/*'
        };
        return this.http.put(`${baseUrl}/namespaces/${namespace}/virtualmachineinstances/${name}/addvolume`, spec, { 'headers': headers } );
    }

    unplugVolume(namespace: string, name: string, spec: removeVolumeOptions): Observable<any> {
        var baseUrl ='./k8s/apis/subresources.kubevirt.io/v1';
        const headers = {
            'accept': '*/*'
        };
        return this.http.put(`${baseUrl}/namespaces/${namespace}/virtualmachineinstances/${name}/removevolume`, spec,  { 'headers': headers } );
    }

}
