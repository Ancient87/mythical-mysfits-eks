FROM ubuntu:latest
RUN apt-get update -y
RUN apt-get install -y python-pip python-dev build-essential
RUN pip install --upgrade pip
#[TODO]: Copy python source files and requirements file into container image
COPY ./service /.
#[TODO]: Install dependencies listed in the requirements.txt file using pip
RUN pip install -r ./requirements.txt
#[TODO]: Specify a listening port for the container
EXPOSE 80
#[TODO]: Run the monolith.py as the final step. We want this container to run as an executable. Looking at ENTRYPOINT for this?
 ENTRYPOINT ["python"]
 CMD ["mythicalMysfitsService.py"]