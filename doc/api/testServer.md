
## The UML
```PlantUML
participant TestServer
participant Device1
participant Device2
participant Device3
TestServer -> TestServer : Start timer
Device1 -> TestServer : send 'present' + { "os": "android" }
Device2 -> TestServer : send 'present' + { "os": "iOS" }
TestServer -> TestServer : Timer Expires
TestServer -> Device1 : send 'start tests' + { "android": 1, "ios": 1 }
TestServer -> Device2 : send 'start tests' + { "android": 1, "ios": 1 }
Device3 -> TestServer : send 'present' + { "os": "iOS" }
TestServer -> Device3 : send 'too late'
```

## Output from plantuml, this is what the picture is supposed to look like

![Example of counting devices](http://plantuml.com/plantuml/svg/fP0n2y8m58Jt_eeZImTrQDqwEEdiqFw1qBxXWJOXUHH1_E-ccc2nHIXkuRYxxrwiTi8jMzqB6l9Ianl8PNOY7sdWbee5hLpGzjcd1hl3f1GLQWb-25y38jREF9xw3hbr51wIOuCxbF6gWj9zvmnt2eyOBbU4-LoFmH_Zcd4MJZVB8VvbJ6CJmRyF2HuVAMbSXM8RQ2zeCGEctUjxuk_-Ut6gIK4n1XSjb3y1)

## In this one we omit @startuml and @enduml
![Testing](http://www.gravizo.com/g?
participant TestServer
participant Device1
participant Device2
participant Device3
TestServer -> TestServer : Start timer
Device1 -> TestServer : send 'present' + { "os": "android" }
Device2 -> TestServer : send 'present' + { "os": "iOS" }
TestServer -> TestServer : Timer Expires
TestServer -> Device1 : send 'start tests' + { "android": 1, "ios": 1 }
TestServer -> Device2 : send 'start tests' + { "android": 1, "ios": 1 }
Device3 -> TestServer : send 'present' + { "os": "iOS" }
TestServer -> Device3 : send 'too late')

## In this one we use @startuml and @enduml
![Testing](http://www.gravizo.com/g?
@startuml
participant TestServer
participant Device1
participant Device2
participant Device3
TestServer -> TestServer : Start timer
Device1 -> TestServer : send 'present' + { "os": "android" }
Device2 -> TestServer : send 'present' + { "os": "iOS" }
TestServer -> TestServer : Timer Expires
TestServer -> Device1 : send 'start tests' + { "android": 1, "ios": 1 }
TestServer -> Device2 : send 'start tests' + { "android": 1, "ios": 1 }
Device3 -> TestServer : send 'present' + { "os": "iOS" }
TestServer -> Device3 : send 'too late'
@enduml)

