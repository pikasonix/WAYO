import { useState, useCallback } from 'react';
import { Instance, Solution, Route, Node } from '../utils/dataModels';

// Hằng số màu sắc được đưa ra ngoài hook để tránh tạo lại mỗi lần render
const ROUTE_COLORS = ["#3775b2", "#b1b945", "#45b940", "#953fbb", "#64d65f", "#396ced", "#7e54d4", "#529d21", "#da68e2", "#8dc74e"];

export function useFileReader() {
    const [instance, setInstance] = useState(null);
    const [solution, setSolution] = useState(null);

    // Tách chuỗi thành token và value
    const tokenAndValue = useCallback((str) => {
        const trimmedStr = str.replace(/\t/g, "").trim();
        const parts = trimmedStr.split(":", 2);
        return parts.length === 1 ? [parts[0].trim()] : [parts[0].trim(), parts[1].trim()];
    }, []);

    const nodeReader = useCallback((elements, index, currentInstance) => {
        currentInstance.nodes = [];
        currentInstance.all_coords = [];
        const size = currentInstance.size;
        for (let i = 0; i < size; i++) {
            const values = elements[index + i].split(" ");
            const node = new Node(
                parseInt(values[0]), [parseFloat(values[1]), parseFloat(values[2])],
                parseInt(values[3]), [parseInt(values[4]), parseInt(values[5])],
                parseInt(values[6]), parseInt(values[7]), parseInt(values[8])
            );
            currentInstance.all_coords.push(node.coords);
            currentInstance.nodes.push(node);
        }
        return index + size - 1;
    }, []);

    const edgeReader = useCallback((elements, index, currentInstance) => {
        currentInstance.times = [];
        const size = currentInstance.size;
        for (let i = 0; i < size; i++) {
            const times_i = elements[index + i].trim().split(" ").map(Number);
            currentInstance.times.push(times_i);
        }
        return index + size - 1;
    }, []);

    const setRouteColors = useCallback((currentSolution) => {
        currentSolution.routes.forEach((route, index) => {
            route.set_color(ROUTE_COLORS[index % ROUTE_COLORS.length]);
        });
    }, []);

    const routeReader = useCallback((elements, index, currentInstance) => {
        const routes = [];
        for (let i = index; i < elements.length; i++) {
            const line = elements[i].trim();
            if (line.length === 0) break;
            if (!line.startsWith("Route")) continue;

            const parts = line.split(":");
            if (parts.length < 2) continue;

            const sequence = parts[1].trim().split(/\s+/).filter(Boolean);
            const route = new Route(routes.length);

            if (!currentInstance?.nodes?.[0] || !currentInstance?.times) {
                console.error("Instance data (nodes, times) is not properly initialized.");
                continue;
            }

            try {
                let cost = 0;
                let lastNodeIndex = 0;
                route.push(0, currentInstance.nodes[0].coords);

                for (const nodeStr of sequence) {
                    const nodeIndex = parseInt(nodeStr, 10);
                    if (isNaN(nodeIndex) || nodeIndex < 0 || nodeIndex >= currentInstance.nodes.length) {
                        console.error(`Invalid node index found: ${nodeStr}`);
                        continue;
                    }
                    cost += currentInstance.times[lastNodeIndex][nodeIndex];
                    route.push(nodeIndex, currentInstance.nodes[nodeIndex].coords);
                    lastNodeIndex = nodeIndex;
                }

                cost += currentInstance.times[lastNodeIndex][0];
                route.push(0, currentInstance.nodes[0].coords);
                route.cost = cost;
                routes.push(route);
            } catch (e) {
                console.error("Error while processing a route:", e);
            }
        }
        return routes;
    }, []);

    const instanceParser = useCallback((fileContent) => {
        const newInstance = new Instance();
        const lines = fileContent.split('\n');
        let i = 0;
        while (i < lines.length) {
            const [token, value] = tokenAndValue(lines[i]);
            switch (token) {
                case "NAME": newInstance.name = value.replace(/\s+/g, ""); break;
                case "LOCATION": newInstance.location = value; break;
                case "TYPE": newInstance.type = value; break;
                case "SIZE": newInstance.size = parseInt(value, 10); break;
                case "CAPACITY": newInstance.capacity = parseInt(value, 10); break;
                case "NODES": i = nodeReader(lines, i + 1, newInstance); break;
                case "EDGES": i = edgeReader(lines, i + 1, newInstance); break;
                case "EOF": i = lines.length; break; // Exit loop
                case "COMMENT": case "DISTRIBUTION": case "DEPOT":
                case "ROUTE-TIME": case "TIME-WINDOW": break; // Ignore these
                default:
                    alert(`ERROR: Unknown keyword '${token}' in instance file.`);
                    throw new Error(`Unknown token in instance file: ${token}`);
            }
            i++;
        }
        setInstance(newInstance);
        return newInstance;
    }, [tokenAndValue, nodeReader, edgeReader]);

    const solutionParser = useCallback((fileContent, currentInstance) => {
        const newSolutionData = { name: "", reference: "", date: "", author: "", routes: [] };
        const lines = fileContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const [token, value] = tokenAndValue(lines[i]);
            switch (token) {
                case "Instance name": newSolutionData.name = value.replace(/\s+/g, ""); break;
                case "Authors": newSolutionData.author = value; break;
                case "Date": newSolutionData.date = value; break;
                case "Reference": newSolutionData.reference = value; break;
                case "Solution":
                    newSolutionData.routes = routeReader(lines, i + 1, currentInstance);
                    i = lines.length; // End loop after reading routes
                    break;
                default:
                    alert(`ERROR: Unknown keyword '${token}' in solution file.`);
                    throw new Error(`Unknown token in solution file: ${token}`);
            }
        }

        if (newSolutionData.routes.length === 0) {
            throw new Error("No routes were parsed from the solution file.");
        }

        const newSolution = new Solution(newSolutionData.name, newSolutionData.reference, newSolutionData.date, newSolutionData.author, newSolutionData.routes);
        setRouteColors(newSolution);
        setSolution(newSolution);
        return newSolution;
    }, [tokenAndValue, routeReader, setRouteColors]);

    const readFileAsText = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error("Error reading file: " + e.target.error));
            reader.readAsText(file);
        });
    };

    const readInstanceFile = useCallback(async (file) => {
        try {
            const fileContent = await readFileAsText(file);
            return instanceParser(fileContent);
        } catch (error) {
            console.error("Failed to read or parse instance file:", error);
            throw error;
        }
    }, [instanceParser]);

    const readSolutionFile = useCallback(async (file, currentInstance) => {
        if (!currentInstance) {
            const error = new Error("Instance data is required to parse a solution file.");
            console.error(error);
            throw error;
        }
        try {
            const fileContent = await readFileAsText(file);
            return solutionParser(fileContent, currentInstance);
        } catch (error) {
            console.error("Failed to read or parse solution file:", error);
            throw error;
        }
    }, [solutionParser]);

    return {
        instance,
        solution,
        readInstanceFile,
        readSolutionFile,
        setInstance,
        setSolution
    };
}