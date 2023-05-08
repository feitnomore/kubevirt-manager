import { LoadBalancerPort } from "./load-balancer-port.model";

export class LoadBalancer {
    name:                string = "";
    namespace:           string = "";
    type:                string = "";
    clusterIP:           string = "";
    loadBalancer:        string = "";
    targetResource:      string = "";
    ports:   LoadBalancerPort[] = [];
}
