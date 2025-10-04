import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ClusterRoleBinding } from '../interfaces/cluster-role-binding';
import { Deployment } from '../interfaces/deployment';
import { HorizontalPodAutoscaler } from '../interfaces/horizontal-pod-autoscaler';
import { RoleBinding } from '../interfaces/role-binding';

const baseUrl ='./k8s/apis'

@Injectable({
  providedIn: 'root'
})
export class K8sApisService {

    constructor(private http: HttpClient) { }

    getCrds(): Observable<any> {
        return this.http.get(`${baseUrl}/apiextensions.k8s.io/v1/customresourcedefinitions`);
    }

    getNetworkAttachs(): Observable<any> {
        return this.http.get(`${baseUrl}/k8s.cni.cncf.io/v1/network-attachment-definitions`);
    }

    getNetworkAttach(namespace: string, name: string): Observable<any> {
        return this.http.get(`${baseUrl}/k8s.cni.cncf.io/v1/namespaces/${namespace}/network-attachment-definitions/${name}`);
    }

    getNetworkPolicies(): Observable<any> {
        return this.http.get(`${baseUrl}/networking.k8s.io/v1/networkpolicies`);
    }

    getNetworkPolicy(namespace: string, name: string): Observable<any> {
        return this.http.get(`${baseUrl}/networking.k8s.io/v1/namespaces/${namespace}/networkpolicies/${name}`);
    }

    getMultiNetworkPolicies(): Observable<any> {
        return this.http.get(`${baseUrl}/k8s.cni.cncf.io/v1beta1/multi-networkpolicies`);
    }

    getMultiNetworkPolicy(namespace: string, name: string): Observable<any> {
        return this.http.get(`${baseUrl}/k8s.cni.cncf.io/v1beta1/namespaces/${namespace}/multi-networkpolicies/${name}`);
    }

    getStorageClasses(): Observable<any> {
        return this.http.get(`${baseUrl}/storage.k8s.io/v1/storageclasses`);
    }

    getPriorityClasses(): Observable<any> {
        return this.http.get(`${baseUrl}/scheduling.k8s.io/v1/priorityclasses?labelSelector=kubevirt-manager.io/managed%3Dtrue`);
    }

    getHpas(): Observable<any> {
        return this.http.get(`${baseUrl}/autoscaling/v2/horizontalpodautoscalers?labelSelector=kubevirt-manager.io/managed%3Dtrue`);
    }

    getNamespacedHpas(namespace: string): Observable<any> {
        return this.http.get(`${baseUrl}/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers?labelSelector=kubevirt-manager.io/managed%3Dtrue`);
    }

    createHpa(horizontalPodAutoscaler: HorizontalPodAutoscaler): Observable<any> {
        let apiVersion = horizontalPodAutoscaler.apiVersion;
        let namespace = horizontalPodAutoscaler.metadata.namespace;
        const headers = {
            'content-type': 'application/json',
            'accept': 'application/json'
        };
        return this.http.post(`${baseUrl}/${apiVersion}/namespaces/${namespace}/horizontalpodautoscalers`, horizontalPodAutoscaler, { 'headers': headers } );
    }

    deleteHPA(namespace: string, name: string): Observable<any> {
        return this.http.delete(`${baseUrl}/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers/${name}`);
    }

    patchHpa(namespace: string, name: string, min: number, max: number, avg: number): Observable<any> {
        const headers = {
            'content-type': 'application/merge-patch+json',
            'accept': 'application/json'
        };
        return this.http.patch(`${baseUrl}/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers/${name}`, '{"spec":{"maxReplicas":'+max+',"metrics":[{"resource":{"name":"cpu","target":{"averageUtilization":'+avg+',"type":"Utilization"}},"type":"Resource"}],"minReplicas":'+min+'}}', { 'headers': headers } );
    }

    createRoleBinding(roleBinding: RoleBinding): Observable<any> {
        let baseUrl = './k8s/apis/' + roleBinding.apiVersion;
        let namespace = roleBinding.metadata.namespace;
        const headers = {
            'content-type': 'application/json',
            'accept': 'application/json'
        };
        return this.http.post(`${baseUrl}/namespaces/${namespace}/rolebindings`, roleBinding, { 'headers': headers } );
    }

    getRoleBinding(namespace: string, name: string): Observable<any> {
        let baseUrl = './k8s/apis/rbac.authorization.k8s.io/v1';
        return this.http.get(`${baseUrl}/namespaces/${namespace}/rolebindings/${name}`);
    }

    deleteRoleBinding(namespace: string, name: string): Observable<any> {
        let baseUrl = './k8s/apis/rbac.authorization.k8s.io/v1';
        return this.http.delete(`${baseUrl}/namespaces/${namespace}/rolebindings/${name}`);
    }

    getClusterRoleBinding(name: string): Observable<any> {
        let baseUrl = './k8s/apis/rbac.authorization.k8s.io/v1';
        return this.http.get(`${baseUrl}/clusterrolebindings/${name}`);
    }

    deleteClusterRoleBinding(name: string): Observable<any> {
        let baseUrl = './k8s/apis/rbac.authorization.k8s.io/v1';
        return this.http.delete(`${baseUrl}/clusterrolebindings/${name}`);
    }

    createClusterRoleBinding(clusterRoleBinding: ClusterRoleBinding): Observable<any> {
        let baseUrl = './k8s/apis/' + clusterRoleBinding.apiVersion;
        const headers = {
            'content-type': 'application/json',
            'accept': 'application/json'
        };
        return this.http.post(`${baseUrl}/clusterrolebindings`, clusterRoleBinding, { 'headers': headers } );
    }


    createDeployment(deployment: Deployment): Observable<any> {
        let baseUrl = './k8s/apis/' + deployment.apiVersion;
        let namespace = deployment.metadata.namespace;
        const headers = {
            'content-type': 'application/json',
            'accept': 'application/json'
        };
        return this.http.post(`${baseUrl}/namespaces/${namespace}/deployments`, deployment, { 'headers': headers } );
    }

    deleteDeployment(namespace: string, name: string): Observable<any> {
        let baseUrl = './k8s/apis/apps/v1';
        return this.http.delete(`${baseUrl}/namespaces/${namespace}/deployments/${name}`);
    }
}
