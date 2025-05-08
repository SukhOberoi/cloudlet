pipeline {
    agent any

    environment {
        IMAGE_NAME = 'cloudlet' // Local Docker image name
        IMAGE_TAG = 'latest'
        CONTAINER_NAME = 'cloudlet-container' // Name of the running container
        VITE_CONVEX_URL = credentials('VITE_CONVEX_URL') // Retrieve the secret from Jenkins
    }

    stages {
        stage('Checkout Code') {
            steps {
                // Clone the repository
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    // Build the Docker image and pass the secret as a build argument
                    sh '''
                    docker build \
                        --build-arg VITE_CONVEX_URL=${VITE_CONVEX_URL} \
                        -t ${IMAGE_NAME}:${IMAGE_TAG} .
                    '''
                }
            }
        }
       stage('Stop Existing Container') {
            steps {
                script {
                    // Stop and remove the existing container if it is running
                    sh '''
                    if [ $(docker ps -q -f name=${CONTAINER_NAME}) ]; then
                        docker stop ${CONTAINER_NAME}
                        docker rm ${CONTAINER_NAME}
                    fi
                    '''
                }
            }
        }
        stage('Run New Container') {
            steps {
                script {
                    // Run the new container and pass the secret as a runtime environment variable
                    sh '''
                    docker run -e VITE_CONVEX_URL=${VITE_CONVEX_URL} -d --name ${CONTAINER_NAME} -p 80:80 ${IMAGE_NAME}:${IMAGE_TAG}
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Application successfully built, tested, and hosted!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}