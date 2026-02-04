# Test Export with Diagrams

This is a test document with a Mermaid diagram.

## Simple Flowchart

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
```

## Another Diagram

```mermaid
pie title Pet adoption by percentage
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15
```

Regular text continues here. The diagrams above should be rendered when you export this.
